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
type BuildProofStatus = "unknown" | "passed" | "failed";
type BuildVerificationState = "not_required" | "pending" | "passed" | "failed";
type ExecutionRunStatus = "running" | "passed" | "failed" | "error" | "cancelled";
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

type BuildBranchRecord = {
  id: string;
  branch_name: string;
  source_branch: string;
  status: string;
  created_at: string | null;
};

type BuildExecutionRun = {
  id: string;
  router_decision_id: string | null;
  mission_id: string | null;
  command_class: string;
  target_scope: string;
  status: ExecutionRunStatus | string;
  summary: string;
  lint_build_summary: string;
  test_summary: string;
  changed_files_summary: string;
  execution_output_excerpt: string;
  proof_status: BuildProofStatus | string;
  failure_note: string;
  rollback_note: string;
  started_at: string | null;
  finished_at: string | null;
};

type BuildGithubSyncState = {
  id: string;
  repo: string;
  branch: string;
  pr_number: string;
  pr_state: string;
  mergeability_summary: string;
  checks_status: "unknown" | "pending" | "passing" | "failing" | string;
  review_status: "unknown" | "pending" | "approved" | "changes_requested" | string;
  head_ref: string;
  base_ref: string;
  blocked_reasons?: string[];
  synced_at: string | null;
};

type BuildGithubDrift = {
  has_drift: boolean;
  items: Array<{
    field: string;
    stored: string;
    live: string;
    reason: string;
  }>;
};

type BuildRequest = {
  id: string;
  goal: string;
  scope_summary: string;
  constraints_json: Record<string, unknown>;
  requested_model_lane: string;
  sensitive_change: boolean;
  desired_proof: string;
  stage: string;
  router_decision_id: string | null;
  mission_id: string | null;
  branch_name: string | null;
  pr_url: string | null;
  pr_number: string | null;
  proof_summary: string;
  test_summary: string;
  files_changed_summary: string;
  proof_status: BuildProofStatus | string;
  verification_state: BuildVerificationState | string;
  recommendation: string;
  latest_execution_run_id: string | null;
  failure_note: string;
  rollback_note: string;
  github_repo: string;
  github_head_ref: string;
  github_base_ref: string;
  github_writeback_status: string;
  github_writeback_error: string;
  github_last_writeback_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  branches?: BuildBranchRecord[];
};

type BuildRequestDetail = BuildRequest & {
  timeline?: TimelineEvent[];
  linked_router_decision?: RouterDecision | null;
  linked_mission?: MissionDetail | null;
  execution_runs?: BuildExecutionRun[];
  github_sync?: BuildGithubSyncState | null;
  github_sync_drift?: BuildGithubDrift;
};

type BuildListResponse = {
  items?: BuildRequest[];
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
const BUILD_STAGE_OPTIONS = [
  "intake",
  "routed",
  "branch_created",
  "implementation_started",
  "tests_run",
  "verification_requested",
  "pr_drafted",
  "approval_pending",
  "ready_for_pr_review",
  "ready_for_merge",
  "revise_before_pr",
  "rejected",
  "rerun_requested",
] as const;

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
  if (["passed", "passing", "ready_for_pr_review", "ready_for_merge", "approved", "clean", "has_hooks"].includes(normalized)) return styles.good;
  if (["failed", "failing", "rejected", "needs_changes", "revise_before_pr", "changes_requested", "dirty", "blocked", "behind"].includes(normalized)) return styles.bad;
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

  const [buildItems, setBuildItems] = useState<BuildRequest[]>([]);
  const [buildTotal, setBuildTotal] = useState(0);
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildStageFilter, setBuildStageFilter] = useState<string>("all");
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);
  const [buildDetail, setBuildDetail] = useState<BuildRequestDetail | null>(null);
  const [buildDetailLoading, setBuildDetailLoading] = useState(false);
  const [buildDetailError, setBuildDetailError] = useState<string | null>(null);

  const [buildGoal, setBuildGoal] = useState("");
  const [buildScope, setBuildScope] = useState("");
  const [buildConstraintsText, setBuildConstraintsText] = useState("{}");
  const [buildRequestedLane, setBuildRequestedLane] = useState("codex");
  const [buildSensitive, setBuildSensitive] = useState(false);
  const [buildDesiredProof, setBuildDesiredProof] = useState("");
  const [buildCreating, setBuildCreating] = useState(false);

  const [buildLinkDecisionId, setBuildLinkDecisionId] = useState("");
  const [buildBranchName, setBuildBranchName] = useState("");
  const [buildStageDetail, setBuildStageDetail] = useState("");
  const [buildStageUpdating, setBuildStageUpdating] = useState<string | null>(null);
  const [buildPrUrl, setBuildPrUrl] = useState("");
  const [buildPrNumber, setBuildPrNumber] = useState("");
  const [buildPrProofSummary, setBuildPrProofSummary] = useState("");
  const [buildPrTestSummary, setBuildPrTestSummary] = useState("");
  const [buildPrFilesSummary, setBuildPrFilesSummary] = useState("");
  const [executionCommandClass, setExecutionCommandClass] = useState("codex");
  const [executionTargetScope, setExecutionTargetScope] = useState("repo");
  const [executionSummary, setExecutionSummary] = useState("");
  const [executionStatus, setExecutionStatus] = useState<ExecutionRunStatus>("passed");
  const [executionProofStatus, setExecutionProofStatus] = useState<BuildProofStatus>("passed");
  const [executionLintSummary, setExecutionLintSummary] = useState("");
  const [executionTestSummary, setExecutionTestSummary] = useState("");
  const [executionFilesSummary, setExecutionFilesSummary] = useState("");
  const [executionOutputExcerpt, setExecutionOutputExcerpt] = useState("");
  const [executionFailureNote, setExecutionFailureNote] = useState("");
  const [executionRollbackNote, setExecutionRollbackNote] = useState("");
  const [executionRequestVerification, setExecutionRequestVerification] = useState(false);
  const [selectedExecutionRunId, setSelectedExecutionRunId] = useState("");
  const [verificationState, setVerificationState] = useState<BuildVerificationState>("pending");
  const [verificationDetail, setVerificationDetail] = useState("");
  const [githubRepoOverride, setGithubRepoOverride] = useState("");
  const [githubPrOverride, setGithubPrOverride] = useState("");
  const [githubWritebackRepo, setGithubWritebackRepo] = useState("");
  const [githubWritebackHead, setGithubWritebackHead] = useState("");
  const [githubWritebackBase, setGithubWritebackBase] = useState("main");
  const [githubWritebackTitle, setGithubWritebackTitle] = useState("");
  const [githubWritebackBody, setGithubWritebackBody] = useState("");
  const [githubWritebackDraft, setGithubWritebackDraft] = useState(true);

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

  const loadBuildList = useCallback(async () => {
    setBuildLoading(true);
    setBuildError(null);
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (buildStageFilter !== "all") params.set("stage", buildStageFilter);
    try {
      const response = await fetch(`/api/familyops/build-intake?${params.toString()}`, { cache: "no-store" });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load build intake queue (${response.status})`));
      }
      const data = (payload && typeof payload === "object" ? payload : {}) as BuildListResponse;
      setBuildItems(Array.isArray(data.items) ? data.items : []);
      setBuildTotal(typeof data.total === "number" ? data.total : 0);
    } catch (loadError) {
      setBuildItems([]);
      setBuildError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setBuildLoading(false);
    }
  }, [buildStageFilter]);

  const loadBuildDetail = useCallback(async (id: string) => {
    setBuildDetailLoading(true);
    setBuildDetailError(null);
    try {
      const response = await fetch(`/api/familyops/build-intake/${encodeURIComponent(id)}?include_timeline=true`, {
        cache: "no-store",
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load build detail (${response.status})`));
      }
      const data = payload as BuildRequestDetail;
      setBuildDetail(data);
      setSelectedBuildId(id);
      setBuildLinkDecisionId(data.router_decision_id || "");
      setBuildBranchName(data.branch_name || "");
      setBuildPrUrl(data.pr_url || "");
      setBuildPrNumber(data.pr_number || "");
      setBuildPrProofSummary(data.proof_summary || "");
      setBuildPrTestSummary(data.test_summary || "");
      setBuildPrFilesSummary(data.files_changed_summary || "");
      setExecutionLintSummary(data.proof_summary || "");
      setExecutionTestSummary(data.test_summary || "");
      setExecutionFilesSummary(data.files_changed_summary || "");
      setExecutionFailureNote(data.failure_note || "");
      setExecutionRollbackNote(data.rollback_note || "");
      const latestRunId = data.latest_execution_run_id || data.execution_runs?.[0]?.id || "";
      setSelectedExecutionRunId(latestRunId);
      setVerificationState((data.verification_state as BuildVerificationState) || "pending");
      setGithubRepoOverride(data.github_sync?.repo || "");
      setGithubPrOverride(data.github_sync?.pr_number || data.pr_number || "");
      setGithubWritebackRepo(data.github_repo || data.github_sync?.repo || "");
      setGithubWritebackHead(data.github_head_ref || data.branch_name || "");
      setGithubWritebackBase(data.github_base_ref || data.github_sync?.base_ref || "main");
      setGithubWritebackTitle(data.goal ? `build: ${data.goal}` : "");
      setGithubWritebackBody("");
      setGithubWritebackDraft(true);
    } catch (loadError) {
      setBuildDetail(null);
      setSelectedBuildId(id);
      setBuildDetailError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setBuildDetailLoading(false);
    }
  }, []);

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

  useEffect(() => {
    void loadBuildList();
  }, [loadBuildList]);

  useEffect(() => {
    if (!selectedBuildId && buildItems.length > 0) {
      void loadBuildDetail(buildItems[0].id);
    }
  }, [buildItems, selectedBuildId, loadBuildDetail]);

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

  async function createBuildIntake(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBuildCreating(true);
    setActionError(null);
    try {
      let constraintsJson: Record<string, unknown> = {};
      if (buildConstraintsText.trim()) {
        constraintsJson = JSON.parse(buildConstraintsText) as Record<string, unknown>;
      }
      const response = await fetch("/api/familyops/build-intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          goal: buildGoal.trim(),
          scope_summary: buildScope.trim(),
          constraints_json: constraintsJson,
          requested_model_lane: buildRequestedLane.trim() || "codex",
          sensitive_change: buildSensitive,
          desired_proof: buildDesiredProof.trim(),
          created_by: createdBy,
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to create build intake (${response.status})`));
      }
      setLastActionPayload(payload);
      setBuildGoal("");
      setBuildScope("");
      setBuildConstraintsText("{}");
      setBuildDesiredProof("");
      await loadBuildList();
      const requestId =
        payload && typeof payload === "object" ? ((payload as { request?: { id?: string } }).request?.id ?? null) : null;
      if (requestId) {
        await loadBuildDetail(requestId);
      }
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBuildCreating(false);
    }
  }

  async function createBuildBranch() {
    if (!buildDetail) return;
    setBuildStageUpdating("branch_created");
    setActionError(null);
    try {
      const response = await fetch(`/api/familyops/build-intake/${encodeURIComponent(buildDetail.id)}/branch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: createdBy,
          source_branch: "main",
          branch_name: buildBranchName.trim() || null,
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to create branch record (${response.status})`));
      }
      setLastActionPayload(payload);
      await loadBuildList();
      await loadBuildDetail(buildDetail.id);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBuildStageUpdating(null);
    }
  }

  async function linkBuildToRouterDecision() {
    if (!buildDetail || !buildLinkDecisionId.trim()) return;
    setBuildStageUpdating("routed");
    setActionError(null);
    try {
      const response = await fetch(`/api/familyops/build-intake/${encodeURIComponent(buildDetail.id)}/route-link`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision_id: buildLinkDecisionId.trim(),
          actor: createdBy,
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to link router decision (${response.status})`));
      }
      setLastActionPayload(payload);
      await loadBuildList();
      await loadBuildDetail(buildDetail.id);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBuildStageUpdating(null);
    }
  }

  async function updateBuildStage(stage: (typeof BUILD_STAGE_OPTIONS)[number]) {
    if (!buildDetail) return;
    setBuildStageUpdating(stage);
    setActionError(null);
    try {
      const response = await fetch(`/api/familyops/build-intake/${encodeURIComponent(buildDetail.id)}/stage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stage,
          actor: createdBy,
          detail: buildStageDetail.trim(),
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to update build stage (${response.status})`));
      }
      setLastActionPayload(payload);
      setBuildStageDetail("");
      await loadBuildList();
      await loadBuildDetail(buildDetail.id);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBuildStageUpdating(null);
    }
  }

  async function savePrDraft() {
    if (!buildDetail || !buildPrUrl.trim()) return;
    setBuildStageUpdating("pr_drafted");
    setActionError(null);
    try {
      const response = await fetch(`/api/familyops/build-intake/${encodeURIComponent(buildDetail.id)}/pr-draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: createdBy,
          pr_url: buildPrUrl.trim(),
          pr_number: buildPrNumber.trim() || null,
          proof_summary: buildPrProofSummary.trim(),
          test_summary: buildPrTestSummary.trim(),
          files_changed_summary: buildPrFilesSummary.trim(),
          stage: "pr_drafted",
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to save PR draft metadata (${response.status})`));
      }
      setLastActionPayload(payload);
      await loadBuildList();
      await loadBuildDetail(buildDetail.id);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBuildStageUpdating(null);
    }
  }

  async function startExecutionRun() {
    if (!buildDetail) return;
    setBuildStageUpdating("implementation_started");
    setActionError(null);
    try {
      const response = await fetch(`/api/familyops/build-intake/${encodeURIComponent(buildDetail.id)}/execution/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: createdBy,
          command_class: executionCommandClass.trim() || "codex",
          target_scope: executionTargetScope.trim() || "repo",
          summary: executionSummary.trim(),
          router_decision_id: buildDetail.router_decision_id || null,
          mission_id: buildDetail.mission_id || null,
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to start execution run (${response.status})`));
      }
      setLastActionPayload(payload);
      await loadBuildList();
      await loadBuildDetail(buildDetail.id);
      const request =
        payload && typeof payload === "object" ? ((payload as { request?: BuildRequestDetail }).request ?? null) : null;
      const runId = request?.latest_execution_run_id || "";
      if (runId) {
        setSelectedExecutionRunId(runId);
      }
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBuildStageUpdating(null);
    }
  }

  async function completeExecutionRun() {
    if (!buildDetail || !selectedExecutionRunId.trim()) return;
    setBuildStageUpdating("tests_run");
    setActionError(null);
    try {
      const response = await fetch(
        `/api/familyops/build-intake/${encodeURIComponent(buildDetail.id)}/execution/${encodeURIComponent(selectedExecutionRunId.trim())}/complete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            actor: createdBy,
            status: executionStatus,
            summary: executionSummary.trim(),
            lint_build_summary: executionLintSummary.trim(),
            test_summary: executionTestSummary.trim(),
            changed_files_summary: executionFilesSummary.trim(),
            execution_output_excerpt: executionOutputExcerpt.trim(),
            proof_status: executionProofStatus,
            request_verification: executionRequestVerification,
            failure_note: executionFailureNote.trim(),
            rollback_note: executionRollbackNote.trim(),
          }),
        },
      );
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to complete execution run (${response.status})`));
      }
      setLastActionPayload(payload);
      setExecutionRequestVerification(false);
      await loadBuildList();
      await loadBuildDetail(buildDetail.id);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBuildStageUpdating(null);
    }
  }

  async function updateBuildVerification(nextState: BuildVerificationState) {
    if (!buildDetail) return;
    setBuildStageUpdating("verification_requested");
    setActionError(null);
    try {
      const response = await fetch(`/api/familyops/build-intake/${encodeURIComponent(buildDetail.id)}/verification`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: createdBy,
          verification_state: nextState,
          detail: verificationDetail.trim(),
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to update verification (${response.status})`));
      }
      setLastActionPayload(payload);
      setVerificationState(nextState);
      setVerificationDetail("");
      await loadBuildList();
      await loadBuildDetail(buildDetail.id);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBuildStageUpdating(null);
    }
  }

  async function syncGithubStatus() {
    if (!buildDetail) return;
    setBuildStageUpdating("approval_pending");
    setActionError(null);
    try {
      const response = await fetch(`/api/familyops/build-intake/${encodeURIComponent(buildDetail.id)}/github-sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: createdBy,
          repo: githubRepoOverride.trim() || null,
          pr_number: githubPrOverride.trim() || null,
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to sync GitHub PR status (${response.status})`));
      }
      setLastActionPayload(payload);
      await loadBuildList();
      await loadBuildDetail(buildDetail.id);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBuildStageUpdating(null);
    }
  }

  async function writebackGithubDraftPr() {
    if (!buildDetail) return;
    setBuildStageUpdating("pr_drafted");
    setActionError(null);
    try {
      const response = await fetch(`/api/familyops/build-intake/${encodeURIComponent(buildDetail.id)}/github-writeback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: createdBy,
          repo: githubWritebackRepo.trim() || null,
          head_branch: githubWritebackHead.trim() || null,
          base_branch: githubWritebackBase.trim() || null,
          title: githubWritebackTitle.trim() || null,
          body: githubWritebackBody.trim() || null,
          draft: githubWritebackDraft,
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed GitHub draft PR writeback (${response.status})`));
      }
      setLastActionPayload(payload);
      await loadBuildList();
      await loadBuildDetail(buildDetail.id);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBuildStageUpdating(null);
    }
  }

  const activeQueue = useMemo(
    () => items.filter((item) => ACTIVE_STATES.has(item.review_state)),
    [items],
  );
  const recentQueue = useMemo(() => items.slice(0, 30), [items]);
  const buildActiveQueue = useMemo(
    () =>
      buildItems.filter((item) =>
        [
          "intake",
          "routed",
          "branch_created",
          "implementation_started",
          "tests_run",
          "verification_requested",
          "pr_drafted",
          "approval_pending",
          "ready_for_pr_review",
          "revise_before_pr",
        ].includes(item.stage),
      ),
    [buildItems],
  );
  const buildRecentQueue = useMemo(() => buildItems.slice(0, 30), [buildItems]);

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

  const buildTimeline = useMemo(() => {
    const records: Array<TimelineEvent & { source: "build" | "router" | "mission" }> = [];
    for (const event of buildDetail?.timeline || []) {
      const sourceRaw = event.metadata && typeof event.metadata === "object" ? String((event.metadata as Record<string, unknown>).source || "build") : "build";
      const source = sourceRaw === "model_router" ? "router" : sourceRaw === "mission_history" ? "mission" : "build";
      records.push({ ...event, source });
    }
    records.sort((a, b) => (a.at || "").localeCompare(b.at || ""));
    return records;
  }, [buildDetail]);

  const mergeReadiness = useMemo(() => {
    const sync = buildDetail?.github_sync;
    if (!sync) {
      return {
        status: "not_synced",
        blockedReasons: ["github_sync_missing"],
      };
    }
    const blocked = Array.isArray(sync.blocked_reasons) ? sync.blocked_reasons : [];
    if (blocked.length > 0) {
      return { status: "blocked", blockedReasons: blocked };
    }
    if (buildDetail?.recommendation === "ready_for_merge") {
      return { status: "ready_for_merge", blockedReasons: [] as string[] };
    }
    return { status: "blocked", blockedReasons: ["recommendation_not_ready_for_merge"] };
  }, [buildDetail]);

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
      {buildError ? <div className={styles.error}>{buildError}</div> : null}
      {actionError ? <div className={styles.error}>{actionError}</div> : null}

      <section className={styles.card}>
        <h2>Build Intake</h2>
        <form className={styles.formGrid} onSubmit={(event) => void createBuildIntake(event)}>
          <label className={styles.span2}>
            Goal
            <input value={buildGoal} onChange={(event) => setBuildGoal(event.target.value)} placeholder="Implement build-intake automation for remote approvals" />
          </label>
          <label className={styles.span2}>
            Scope
            <input value={buildScope} onChange={(event) => setBuildScope(event.target.value)} placeholder="Minimal coherent API + UI + tests" />
          </label>
          <label>
            Requested Model Lane
            <input value={buildRequestedLane} onChange={(event) => setBuildRequestedLane(event.target.value)} />
          </label>
          <label>
            Desired Proof
            <input value={buildDesiredProof} onChange={(event) => setBuildDesiredProof(event.target.value)} placeholder="web lint/build, worker/api tests" />
          </label>
          <label className={styles.span2}>
            Constraints JSON
            <textarea rows={3} value={buildConstraintsText} onChange={(event) => setBuildConstraintsText(event.target.value)} />
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={buildSensitive} onChange={(event) => setBuildSensitive(event.target.checked)} />
            Sensitive change (force stricter verification)
          </label>
          <div className={styles.formActions}>
            <button type="submit" disabled={buildCreating}>
              {buildCreating ? "Submitting..." : "Submit Build Intake"}
            </button>
          </div>
        </form>
      </section>

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

      <section className={styles.card}>
        <h2>Build Queue Filters</h2>
        <div className={styles.filterGrid}>
          <label>
            Stage
            <select value={buildStageFilter} onChange={(event) => setBuildStageFilter(event.target.value)}>
              <option value="all">all</option>
              {BUILD_STAGE_OPTIONS.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void loadBuildList()} disabled={buildLoading}>
            {buildLoading ? "Refreshing..." : "Refresh Build Queue"}
          </button>
        </div>
        <p className={styles.muted}>Build requests: {buildTotal}</p>
      </section>

      <section className={styles.grid2}>
        <div className={styles.card}>
          <h2>Active Build Intake Queue</h2>
          <div className={styles.list}>
            {buildActiveQueue.length === 0 ? <div className={styles.muted}>No active build requests.</div> : null}
            {buildActiveQueue.map((item) => (
              <button key={item.id} type="button" className={styles.item} onClick={() => void loadBuildDetail(item.id)}>
                <div className={styles.itemHeader}>
                  <strong>{item.goal || "build-request"}</strong>
                  <span className={`${styles.badge} ${badgeClass(item.stage)}`}>{item.stage}</span>
                </div>
                <div className={styles.itemMeta}>
                  lane {item.requested_model_lane || "-"} · branch {item.branch_name || "-"} · pr {item.pr_number || item.pr_url || "-"}
                </div>
                <div className={styles.itemMeta}>
                  proof {item.proof_status || "-"} · verification {item.verification_state || "-"} · recommendation {item.recommendation || "-"}
                </div>
                <div className={styles.itemMeta}>{item.scope_summary || "-"}</div>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <h2>Recent Build Requests</h2>
          <div className={styles.list}>
            {buildRecentQueue.length === 0 ? <div className={styles.muted}>No build requests found.</div> : null}
            {buildRecentQueue.map((item) => (
              <button key={`build-recent-${item.id}`} type="button" className={styles.item} onClick={() => void loadBuildDetail(item.id)}>
                <div className={styles.itemHeader}>
                  <strong>{formatDateTime(item.updated_at || item.created_at)}</strong>
                  <span className={`${styles.badge} ${badgeClass(item.stage)}`}>{item.stage}</span>
                </div>
                <div className={styles.itemMeta}>{item.goal || "-"}</div>
                <div className={styles.itemMeta}>router decision: {item.router_decision_id || "-"}</div>
                <div className={styles.itemMeta}>recommendation: {item.recommendation || "-"}</div>
              </button>
            ))}
          </div>
        </div>
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
        <h2>Build Execution Detail</h2>
        {buildDetailLoading ? <div className={styles.muted}>Loading build detail...</div> : null}
        {buildDetailError ? <div className={styles.error}>{buildDetailError}</div> : null}
        {!buildDetailLoading && !buildDetail ? <div className={styles.muted}>Select a build request to inspect and advance stages.</div> : null}

        {buildDetail ? (
          <div className={styles.detailWrap}>
            <div className={styles.detailGrid}>
              <div><strong>ID:</strong> {buildDetail.id}</div>
              <div><strong>Stage:</strong> <span className={`${styles.badge} ${badgeClass(buildDetail.stage)}`}>{buildDetail.stage}</span></div>
              <div><strong>Recommendation:</strong> <span className={`${styles.badge} ${badgeClass(buildDetail.recommendation || "unknown")}`}>{buildDetail.recommendation || "-"}</span></div>
              <div><strong>Proof Status:</strong> <span className={`${styles.badge} ${badgeClass(buildDetail.proof_status || "unknown")}`}>{buildDetail.proof_status || "-"}</span></div>
              <div><strong>Verification:</strong> <span className={`${styles.badge} ${badgeClass(buildDetail.verification_state || "unknown")}`}>{buildDetail.verification_state || "-"}</span></div>
              <div><strong>Latest Execution Run:</strong> {buildDetail.latest_execution_run_id || "-"}</div>
              <div><strong>Goal:</strong> {buildDetail.goal || "-"}</div>
              <div><strong>Lane:</strong> {buildDetail.requested_model_lane || "-"}</div>
              <div><strong>Branch:</strong> {buildDetail.branch_name || "-"}</div>
              <div><strong>Router Decision:</strong> {buildDetail.router_decision_id || "-"}</div>
              <div><strong>PR:</strong> {buildDetail.pr_number || buildDetail.pr_url || "-"}</div>
              <div><strong>Sensitive:</strong> {buildDetail.sensitive_change ? "true" : "false"}</div>
              <div><strong>Desired Proof:</strong> {buildDetail.desired_proof || "-"}</div>
              <div><strong>Scope:</strong> {buildDetail.scope_summary || "-"}</div>
              <div><strong>Files Summary:</strong> {buildDetail.files_changed_summary || "-"}</div>
              <div><strong>Test Summary:</strong> {buildDetail.test_summary || "-"}</div>
              <div><strong>Proof Summary:</strong> {buildDetail.proof_summary || "-"}</div>
              <div><strong>Failure Note:</strong> {buildDetail.failure_note || "-"}</div>
              <div><strong>Rollback Note:</strong> {buildDetail.rollback_note || "-"}</div>
              <div><strong>Writeback Status:</strong> <span className={`${styles.badge} ${badgeClass(buildDetail.github_writeback_status || "unknown")}`}>{buildDetail.github_writeback_status || "-"}</span></div>
              <div><strong>Last Writeback:</strong> {formatDateTime(buildDetail.github_last_writeback_at)}</div>
              <div><strong>Writeback Repo:</strong> {buildDetail.github_repo || "-"}</div>
              <div><strong>Writeback Head/Base:</strong> {buildDetail.github_head_ref || "-"} → {buildDetail.github_base_ref || "-"}</div>
              <div><strong>Writeback Error:</strong> {buildDetail.github_writeback_error || "-"}</div>
            </div>

            <div className={styles.linkRow}>
              {buildDetail.branch_name ? (
                <a href={branchLink(buildDetail.branch_name) || "#"} target="_blank" rel="noreferrer">
                  Open Build Branch
                </a>
              ) : (
                <span className={styles.muted}>No branch linked yet</span>
              )}
              {prLink(buildDetail.pr_url || buildDetail.pr_number) ? (
                <a href={prLink(buildDetail.pr_url || buildDetail.pr_number) || "#"} target="_blank" rel="noreferrer">
                  Open Draft PR
                </a>
              ) : (
                <span className={styles.muted}>No PR linked yet</span>
              )}
            </div>

            <div className={styles.actionBlock}>
              <h3>Build Orchestration Actions</h3>
              <label>
                Stage/Action Note
                <textarea rows={3} value={buildStageDetail} onChange={(event) => setBuildStageDetail(event.target.value)} />
              </label>
              <label>
                Branch Name (optional)
                <input value={buildBranchName} onChange={(event) => setBuildBranchName(event.target.value)} placeholder="build/my-feature-1234abcd" />
              </label>
              <div className={styles.actionGrid}>
                <button type="button" onClick={() => void createBuildBranch()} disabled={Boolean(buildStageUpdating)}>
                  Create Branch Record
                </button>
                <button type="button" onClick={() => void updateBuildStage("implementation_started")} disabled={Boolean(buildStageUpdating)}>
                  Mark Implementation Started
                </button>
                <button type="button" onClick={() => void updateBuildStage("tests_run")} disabled={Boolean(buildStageUpdating)}>
                  Mark Tests Run
                </button>
                <button type="button" onClick={() => void updateBuildStage("verification_requested")} disabled={Boolean(buildStageUpdating)}>
                  Request Verification
                </button>
                <button type="button" onClick={() => void updateBuildStage("approval_pending")} disabled={Boolean(buildStageUpdating)}>
                  Mark Approval Pending
                </button>
                <button type="button" onClick={() => void updateBuildStage("ready_for_pr_review")} disabled={Boolean(buildStageUpdating)}>
                  Mark Ready for PR Review
                </button>
                <button type="button" onClick={() => void updateBuildStage("ready_for_merge")} disabled={Boolean(buildStageUpdating)}>
                  Mark Ready for Merge
                </button>
                <button type="button" onClick={() => void updateBuildStage("revise_before_pr")} disabled={Boolean(buildStageUpdating)}>
                  Mark Revise Before PR
                </button>
                <button type="button" onClick={() => void updateBuildStage("rejected")} disabled={Boolean(buildStageUpdating)}>
                  Mark Rejected
                </button>
                <button type="button" onClick={() => void updateBuildStage("rerun_requested")} disabled={Boolean(buildStageUpdating)}>
                  Mark Re-Run Requested
                </button>
              </div>
              {buildStageUpdating ? <div className={styles.muted}>Updating {buildStageUpdating}...</div> : null}
            </div>

            <div className={styles.actionBlock}>
              <h3>Execution Runner + Proof Ingestion</h3>
              <label>
                Command Class
                <input value={executionCommandClass} onChange={(event) => setExecutionCommandClass(event.target.value)} placeholder="codex" />
              </label>
              <label>
                Target Scope
                <input value={executionTargetScope} onChange={(event) => setExecutionTargetScope(event.target.value)} placeholder="services/api + apps/tufflove-web" />
              </label>
              <label>
                Execution Summary
                <textarea rows={2} value={executionSummary} onChange={(event) => setExecutionSummary(event.target.value)} />
              </label>
              <button type="button" onClick={() => void startExecutionRun()} disabled={Boolean(buildStageUpdating)}>
                Start Execution Run
              </button>

              <label>
                Run to Complete
                <select value={selectedExecutionRunId} onChange={(event) => setSelectedExecutionRunId(event.target.value)}>
                  <option value="">select run</option>
                  {(buildDetail.execution_runs || []).map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.id} · {run.status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Execution Status
                <select value={executionStatus} onChange={(event) => setExecutionStatus(event.target.value as ExecutionRunStatus)}>
                  <option value="passed">passed</option>
                  <option value="failed">failed</option>
                  <option value="error">error</option>
                  <option value="cancelled">cancelled</option>
                  <option value="running">running</option>
                </select>
              </label>
              <label>
                Proof Status
                <select value={executionProofStatus} onChange={(event) => setExecutionProofStatus(event.target.value as BuildProofStatus)}>
                  <option value="unknown">unknown</option>
                  <option value="passed">passed</option>
                  <option value="failed">failed</option>
                </select>
              </label>
              <label>
                Lint/Build Summary
                <textarea rows={2} value={executionLintSummary} onChange={(event) => setExecutionLintSummary(event.target.value)} />
              </label>
              <label>
                Test Summary
                <textarea rows={2} value={executionTestSummary} onChange={(event) => setExecutionTestSummary(event.target.value)} />
              </label>
              <label>
                Changed Files Summary
                <textarea rows={2} value={executionFilesSummary} onChange={(event) => setExecutionFilesSummary(event.target.value)} />
              </label>
              <label>
                Execution Output Excerpt (redacted)
                <textarea rows={4} value={executionOutputExcerpt} onChange={(event) => setExecutionOutputExcerpt(event.target.value)} />
              </label>
              <label>
                Failure Note
                <textarea rows={2} value={executionFailureNote} onChange={(event) => setExecutionFailureNote(event.target.value)} />
              </label>
              <label>
                Rollback Note
                <textarea rows={2} value={executionRollbackNote} onChange={(event) => setExecutionRollbackNote(event.target.value)} />
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={executionRequestVerification}
                  onChange={(event) => setExecutionRequestVerification(event.target.checked)}
                />
                Request second-model verification after proof ingestion
              </label>
              <button type="button" onClick={() => void completeExecutionRun()} disabled={Boolean(buildStageUpdating) || !selectedExecutionRunId.trim()}>
                Complete Execution + Ingest Proof
              </button>
            </div>

            <div className={styles.actionBlock}>
              <h3>Verification Hook</h3>
              <label>
                Verification State
                <select value={verificationState} onChange={(event) => setVerificationState(event.target.value as BuildVerificationState)}>
                  <option value="pending">pending</option>
                  <option value="passed">passed</option>
                  <option value="failed">failed</option>
                  <option value="not_required">not_required</option>
                </select>
              </label>
              <label>
                Verification Detail
                <textarea rows={2} value={verificationDetail} onChange={(event) => setVerificationDetail(event.target.value)} />
              </label>
              <div className={styles.actionGrid}>
                <button type="button" onClick={() => void updateBuildVerification("pending")} disabled={Boolean(buildStageUpdating)}>
                  Request Verification
                </button>
                <button type="button" onClick={() => void updateBuildVerification("passed")} disabled={Boolean(buildStageUpdating)}>
                  Mark Verification Passed
                </button>
                <button type="button" onClick={() => void updateBuildVerification("failed")} disabled={Boolean(buildStageUpdating)}>
                  Mark Verification Failed
                </button>
              </div>
            </div>

            <div className={styles.actionBlock}>
              <h3>Router + PR Linkage</h3>
              <label>
                Router Decision ID
                <input value={buildLinkDecisionId} onChange={(event) => setBuildLinkDecisionId(event.target.value)} placeholder="decision-uuid" />
              </label>
              <button type="button" onClick={() => void linkBuildToRouterDecision()} disabled={Boolean(buildStageUpdating) || !buildLinkDecisionId.trim()}>
                Link Router Decision
              </button>

              <label>
                PR URL
                <input value={buildPrUrl} onChange={(event) => setBuildPrUrl(event.target.value)} placeholder="https://github.com/.../pull/123" />
              </label>
              <label>
                PR Number
                <input value={buildPrNumber} onChange={(event) => setBuildPrNumber(event.target.value)} placeholder="123" />
              </label>
              <label>
                Proof Summary
                <textarea rows={2} value={buildPrProofSummary} onChange={(event) => setBuildPrProofSummary(event.target.value)} />
              </label>
              <label>
                Test Summary
                <textarea rows={2} value={buildPrTestSummary} onChange={(event) => setBuildPrTestSummary(event.target.value)} />
              </label>
              <label>
                Files Changed Summary
                <textarea rows={2} value={buildPrFilesSummary} onChange={(event) => setBuildPrFilesSummary(event.target.value)} />
              </label>
              <button type="button" onClick={() => void savePrDraft()} disabled={Boolean(buildStageUpdating) || !buildPrUrl.trim()}>
                Save PR Draft Metadata
              </button>
            </div>

            <div className={styles.actionBlock}>
              <h3>GitHub Draft PR Writeback</h3>
              <label>
                Repo
                <input value={githubWritebackRepo} onChange={(event) => setGithubWritebackRepo(event.target.value)} placeholder="BeTeachableLLC/tufflove-platform" />
              </label>
              <label>
                Head Branch
                <input value={githubWritebackHead} onChange={(event) => setGithubWritebackHead(event.target.value)} placeholder="build/my-feature-1234abcd" />
              </label>
              <label>
                Base Branch
                <input value={githubWritebackBase} onChange={(event) => setGithubWritebackBase(event.target.value)} placeholder="main" />
              </label>
              <label>
                PR Title (optional)
                <input value={githubWritebackTitle} onChange={(event) => setGithubWritebackTitle(event.target.value)} placeholder="build: implement feature slice" />
              </label>
              <label>
                PR Body Override (optional)
                <textarea rows={5} value={githubWritebackBody} onChange={(event) => setGithubWritebackBody(event.target.value)} />
              </label>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={githubWritebackDraft} onChange={(event) => setGithubWritebackDraft(event.target.checked)} />
                Draft PR
              </label>
              <button
                type="button"
                onClick={() => void writebackGithubDraftPr()}
                disabled={Boolean(buildStageUpdating) || !githubWritebackRepo.trim() || !githubWritebackHead.trim()}
              >
                Create/Update Draft PR in GitHub
              </button>
              {!buildDetail.github_sync ? (
                <div className={styles.muted}>Live GitHub state not synced yet.</div>
              ) : buildDetail.github_sync_drift?.has_drift ? (
                <div className={styles.muted}>
                  Local metadata does not match live GitHub state.
                </div>
              ) : (
                <div className={styles.muted}>Local metadata matches live GitHub state.</div>
              )}
            </div>

            <div className={styles.actionBlock}>
              <h3>Live GitHub PR Sync</h3>
              <label>
                Repo Override (optional)
                <input value={githubRepoOverride} onChange={(event) => setGithubRepoOverride(event.target.value)} placeholder="BeTeachableLLC/tufflove-platform" />
              </label>
              <label>
                PR Number Override (optional)
                <input value={githubPrOverride} onChange={(event) => setGithubPrOverride(event.target.value)} placeholder="123" />
              </label>
              <button type="button" onClick={() => void syncGithubStatus()} disabled={Boolean(buildStageUpdating)}>
                Sync GitHub PR Status
              </button>

              {buildDetail.github_sync ? (
                <div className={styles.detailGrid}>
                  <div><strong>Repo:</strong> {buildDetail.github_sync.repo || "-"}</div>
                  <div><strong>PR:</strong> {buildDetail.github_sync.pr_number || "-"}</div>
                  <div><strong>PR State:</strong> <span className={`${styles.badge} ${badgeClass(buildDetail.github_sync.pr_state || "unknown")}`}>{buildDetail.github_sync.pr_state || "-"}</span></div>
                  <div><strong>Mergeability:</strong> <span className={`${styles.badge} ${badgeClass((buildDetail.github_sync.mergeability_summary || "unknown").toLowerCase())}`}>{buildDetail.github_sync.mergeability_summary || "-"}</span></div>
                  <div><strong>Checks:</strong> <span className={`${styles.badge} ${badgeClass(buildDetail.github_sync.checks_status || "unknown")}`}>{buildDetail.github_sync.checks_status || "-"}</span></div>
                  <div><strong>Reviews:</strong> <span className={`${styles.badge} ${badgeClass(buildDetail.github_sync.review_status || "unknown")}`}>{buildDetail.github_sync.review_status || "-"}</span></div>
                  <div><strong>Head/Base:</strong> {buildDetail.github_sync.head_ref || "-"} → {buildDetail.github_sync.base_ref || "-"}</div>
                  <div><strong>Synced At:</strong> {formatDateTime(buildDetail.github_sync.synced_at)}</div>
                  <div><strong>Merge Readiness:</strong> <span className={`${styles.badge} ${badgeClass(mergeReadiness.status)}`}>{mergeReadiness.status}</span></div>
                </div>
              ) : (
                <div className={styles.muted}>No GitHub sync snapshot yet.</div>
              )}

              {mergeReadiness.blockedReasons.length > 0 ? (
                <div className={styles.muted}>Blocked reasons: {mergeReadiness.blockedReasons.join(", ")}</div>
              ) : null}
              {buildDetail.github_sync_drift?.has_drift ? (
                <div className={styles.muted}>
                  Metadata drift detected: {buildDetail.github_sync_drift.items.map((item) => item.reason).join(", ")}
                </div>
              ) : null}
            </div>

            <div className={styles.timelineBlock}>
              <h3>Execution Runs</h3>
              {(buildDetail.execution_runs || []).length === 0 ? <div className={styles.muted}>No execution runs yet.</div> : null}
              {(buildDetail.execution_runs || []).map((run) => (
                <div key={run.id} className={styles.timelineItem}>
                  <div className={styles.timelineMeta}>
                    <span>{formatDateTime(run.started_at)}</span>
                    <span className={`${styles.badge} ${badgeClass(run.status || "unknown")}`}>{run.status}</span>
                    <span className={`${styles.badge} ${badgeClass(run.proof_status || "unknown")}`}>proof {run.proof_status}</span>
                  </div>
                  <div><strong>{run.command_class || "-"}</strong> · {run.target_scope || "-"}</div>
                  <div>{run.summary || "-"}</div>
                  <div className={styles.itemMeta}>lint/build: {run.lint_build_summary || "-"}</div>
                  <div className={styles.itemMeta}>tests: {run.test_summary || "-"}</div>
                  <div className={styles.itemMeta}>files: {run.changed_files_summary || "-"}</div>
                  <div className={styles.itemMeta}>failure note: {run.failure_note || "-"}</div>
                  <div className={styles.itemMeta}>rollback note: {run.rollback_note || "-"}</div>
                  {run.execution_output_excerpt ? <pre>{run.execution_output_excerpt}</pre> : null}
                </div>
              ))}
            </div>

            <div className={styles.timelineBlock}>
              <h3>Build Intake + Router + Mission Timeline</h3>
              {buildTimeline.length === 0 ? <div className={styles.muted}>No timeline records yet.</div> : null}
              {buildTimeline.map((event, index) => (
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
          </div>
        ) : null}
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
