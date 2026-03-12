"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type OperatorSummary = {
  operator_id: string;
  version_count: number;
  active_version_id: string | null;
  active_version_number: number | null;
  updated_at: string | null;
};

type OperatorVersion = {
  id: string;
  operator_id: string;
  version_number: number;
  status: string;
  created_at: string | null;
  updated_at: string | null;
};

type TriggerSummary = {
  id: string;
  trigger_type: string;
  enabled: boolean;
  next_run_at: string | null;
  last_fired_at: string | null;
} | null;

type MissionRecord = {
  id: string;
  tenant_id: string;
  user_id: string;
  operator_id: string;
  operator_version_id: string;
  trigger_id: string | null;
  source: string;
  approval_task_id: string | null;
  status: "running" | "completed" | "partial" | "blocked" | "failed";
  summary: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  redacted_tool_log: unknown[];
  tool_calls_redacted: unknown[];
  artifacts: unknown[];
  token_estimate: number;
  cost_estimate: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MissionAuditEvent = {
  id: number;
  event_type: string;
  event_status: string;
  detail: string;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string | null;
};

type MissionDetail = MissionRecord & {
  audit_events: MissionAuditEvent[];
  trigger: TriggerSummary;
};

const STATUS_OPTIONS = ["", "running", "completed", "partial", "blocked", "failed"] as const;
const SOURCE_OPTIONS = ["", "manual", "trigger", "webhook", "internal"] as const;

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

function toPrettyJson(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toDisplayTime(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function shortId(value: string): string {
  if (value.length <= 10) return value;
  return `${value.slice(0, 8)}…`;
}

export default function MissionsClient() {
  const [operators, setOperators] = useState<OperatorSummary[]>([]);
  const [versions, setVersions] = useState<OperatorVersion[]>([]);
  const [operatorId, setOperatorId] = useState("");
  const [operatorVersionId, setOperatorVersionId] = useState("");
  const [status, setStatus] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [startedAfter, setStartedAfter] = useState("");
  const [startedBefore, setStartedBefore] = useState("");
  const [limit, setLimit] = useState(25);

  const [missions, setMissions] = useState<MissionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedMissionId, setSelectedMissionId] = useState("");
  const [missionDetail, setMissionDetail] = useState<MissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadOperators = useCallback(async () => {
    try {
      const response = await fetch("/api/familyops/operators", { cache: "no-store" });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load operators (${response.status})`));
      }
      const parsed =
        payload && typeof payload === "object" && Array.isArray((payload as { operators?: unknown[] }).operators)
          ? ((payload as { operators: OperatorSummary[] }).operators || [])
          : [];
      setOperators(parsed);
      if (!operatorId && parsed.length > 0) {
        setOperatorId(parsed[0].operator_id);
      }
    } catch {
      setOperators([]);
    }
  }, [operatorId]);

  const loadVersions = useCallback(
    async (nextOperatorId: string) => {
      if (!nextOperatorId.trim()) {
        setVersions([]);
        setOperatorVersionId("");
        return;
      }
      try {
        const response = await fetch(`/api/familyops/operator/${encodeURIComponent(nextOperatorId)}/versions`, {
          cache: "no-store",
        });
        const payload = await readResponse(response);
        if (!response.ok) {
          throw new Error(parseError(payload, `Failed to load versions (${response.status})`));
        }
        const parsed =
          payload && typeof payload === "object" && Array.isArray((payload as { versions?: unknown[] }).versions)
            ? ((payload as { versions: OperatorVersion[] }).versions || [])
            : [];
        setVersions(parsed);
        if (parsed.length === 0) {
          setOperatorVersionId("");
          return;
        }
        if (!parsed.find((version) => version.id === operatorVersionId)) {
          setOperatorVersionId(parsed[0].id);
        }
      } catch {
        setVersions([]);
        setOperatorVersionId("");
      }
    },
    [operatorVersionId],
  );

  const loadMissions = useCallback(
    async (nextOffset: number) => {
      setListLoading(true);
      setListError(null);
      try {
        const params = new URLSearchParams();
        if (operatorId.trim()) params.set("operator_id", operatorId.trim());
        if (operatorVersionId.trim()) params.set("operator_version_id", operatorVersionId.trim());
        if (status.trim()) params.set("status", status.trim());
        if (source.trim()) params.set("source", source.trim());
        if (startedAfter.trim()) params.set("started_after", startedAfter.trim());
        if (startedBefore.trim()) params.set("started_before", startedBefore.trim());
        params.set("limit", String(limit));
        params.set("offset", String(Math.max(nextOffset, 0)));

        const response = await fetch(`/api/familyops/operator/missions?${params.toString()}`, { cache: "no-store" });
        const payload = await readResponse(response);
        if (!response.ok) {
          throw new Error(parseError(payload, `Failed to load missions (${response.status})`));
        }
        const records =
          payload && typeof payload === "object" && Array.isArray((payload as { missions?: unknown[] }).missions)
            ? ((payload as { missions: MissionRecord[] }).missions || [])
            : [];
        const nextTotal =
          payload && typeof payload === "object" && typeof (payload as { total?: unknown }).total === "number"
            ? (payload as { total: number }).total
            : 0;
        const nextOffsetValue =
          payload && typeof payload === "object" && typeof (payload as { offset?: unknown }).offset === "number"
            ? (payload as { offset: number }).offset
            : Math.max(nextOffset, 0);
        setMissions(records);
        setTotal(nextTotal);
        setOffset(nextOffsetValue);
      } catch (error) {
        setListError(error instanceof Error ? error.message : String(error));
        setMissions([]);
        setTotal(0);
      } finally {
        setListLoading(false);
      }
    },
    [limit, operatorId, operatorVersionId, source, startedAfter, startedBefore, status],
  );

  const loadMissionDetail = useCallback(async (missionId: string) => {
    if (!missionId.trim()) {
      setMissionDetail(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetch(`/api/familyops/operator/mission/${encodeURIComponent(missionId)}`, {
        cache: "no-store",
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load mission detail (${response.status})`));
      }
      setMissionDetail(payload as MissionDetail);
    } catch (error) {
      setMissionDetail(null);
      setDetailError(error instanceof Error ? error.message : String(error));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOperators();
  }, [loadOperators]);

  useEffect(() => {
    void loadVersions(operatorId);
  }, [loadVersions, operatorId]);

  useEffect(() => {
    void loadMissions(0);
  }, [loadMissions]);

  useEffect(() => {
    if (!selectedMissionId) return;
    void loadMissionDetail(selectedMissionId);
  }, [loadMissionDetail, selectedMissionId]);

  const hasPreviousPage = offset > 0;
  const hasNextPage = offset + missions.length < total;

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>FamilyOps Mission History</h1>
      <p style={{ color: "#9ca3af", marginBottom: 14 }}>
        Inspect mission outcomes with version linkage, redacted tool trail, and audit context.
      </p>
      <p style={{ marginBottom: 20 }}>
        <Link href="/familyops/operators" style={{ textDecoration: "underline" }}>
          FamilyOps Operators
        </Link>
        {" · "}
        <Link href="/familyops/triggers" style={{ textDecoration: "underline" }}>
          FamilyOps Triggers
        </Link>
        {" · "}
        <Link href="/familyops/approvals" style={{ textDecoration: "underline" }}>
          FamilyOps Approvals
        </Link>
      </p>

      <section
        style={{
          border: "1px solid #374151",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          background: "#0f172a",
          color: "#e5e7eb",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 20 }}>Filters</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <label>
            <div style={{ marginBottom: 4, fontSize: 12 }}>Operator</div>
            <select
              value={operatorId}
              onChange={(event) => setOperatorId(event.target.value)}
              style={{ width: "100%", padding: "8px 10px" }}
            >
              <option value="">All operators</option>
              {operators.map((operator) => (
                <option key={operator.operator_id} value={operator.operator_id}>
                  {operator.operator_id}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={{ marginBottom: 4, fontSize: 12 }}>Version</div>
            <select
              value={operatorVersionId}
              onChange={(event) => setOperatorVersionId(event.target.value)}
              style={{ width: "100%", padding: "8px 10px" }}
            >
              <option value="">All versions</option>
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.version_number} ({version.status})
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={{ marginBottom: 4, fontSize: 12 }}>Status</div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              style={{ width: "100%", padding: "8px 10px" }}
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value || "all"} value={value}>
                  {value || "all"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={{ marginBottom: 4, fontSize: 12 }}>Source</div>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              style={{ width: "100%", padding: "8px 10px" }}
            >
              {SOURCE_OPTIONS.map((value) => (
                <option key={value || "all"} value={value}>
                  {value || "all"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={{ marginBottom: 4, fontSize: 12 }}>Started After</div>
            <input
              type="datetime-local"
              value={startedAfter}
              onChange={(event) => setStartedAfter(event.target.value)}
              style={{ width: "100%", padding: "8px 10px" }}
            />
          </label>
          <label>
            <div style={{ marginBottom: 4, fontSize: 12 }}>Started Before</div>
            <input
              type="datetime-local"
              value={startedBefore}
              onChange={(event) => setStartedBefore(event.target.value)}
              style={{ width: "100%", padding: "8px 10px" }}
            />
          </label>
          <label>
            <div style={{ marginBottom: 4, fontSize: 12 }}>Page Size</div>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(event) => setLimit(Math.min(Math.max(Number(event.target.value) || 25, 1), 200))}
              style={{ width: "100%", padding: "8px 10px" }}
            />
          </label>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void loadMissions(0)}
            style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "8px 12px" }}
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus("");
              setSource("");
              setOperatorVersionId("");
              setStartedAfter("");
              setStartedBefore("");
              void loadMissions(0);
            }}
            style={{ background: "#334155", color: "#fff", border: "none", borderRadius: 6, padding: "8px 12px" }}
          >
            Reset
          </button>
        </div>
      </section>

      {listError ? <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 600 }}>{listError}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        <section style={{ border: "1px solid #374151", borderRadius: 8, padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Recent Missions</h2>
          <div style={{ marginBottom: 10, color: "#6b7280", fontSize: 13 }}>
            total={total} · offset={offset} · showing={missions.length}
          </div>
          {listLoading ? <div>Loading missions…</div> : null}
          {!listLoading && missions.length === 0 ? <div>No missions found for current filters.</div> : null}
          {!listLoading && missions.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #d1d5db" }}>
                    <th style={{ padding: "6px 4px" }}>Mission</th>
                    <th style={{ padding: "6px 4px" }}>Status</th>
                    <th style={{ padding: "6px 4px" }}>Operator</th>
                    <th style={{ padding: "6px 4px" }}>Version</th>
                    <th style={{ padding: "6px 4px" }}>Source</th>
                    <th style={{ padding: "6px 4px" }}>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {missions.map((mission) => (
                    <tr
                      key={mission.id}
                      onClick={() => setSelectedMissionId(mission.id)}
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                        cursor: "pointer",
                        background: selectedMissionId === mission.id ? "#f1f5f9" : "transparent",
                      }}
                    >
                      <td style={{ padding: "6px 4px", fontFamily: "monospace" }}>{shortId(mission.id)}</td>
                      <td style={{ padding: "6px 4px" }}>{mission.status}</td>
                      <td style={{ padding: "6px 4px" }}>{mission.operator_id}</td>
                      <td style={{ padding: "6px 4px", fontFamily: "monospace" }}>{shortId(mission.operator_version_id)}</td>
                      <td style={{ padding: "6px 4px" }}>{mission.source}</td>
                      <td style={{ padding: "6px 4px" }}>{toDisplayTime(mission.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={!hasPreviousPage || listLoading}
              onClick={() => void loadMissions(Math.max(offset - limit, 0))}
              style={{ padding: "6px 10px" }}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!hasNextPage || listLoading}
              onClick={() => void loadMissions(offset + limit)}
              style={{ padding: "6px 10px" }}
            >
              Next
            </button>
          </div>
        </section>

        <section style={{ border: "1px solid #374151", borderRadius: 8, padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Mission Detail</h2>
          {detailError ? <div style={{ color: "#ef4444", marginBottom: 8 }}>{detailError}</div> : null}
          {detailLoading ? <div>Loading mission detail…</div> : null}
          {!detailLoading && !missionDetail ? <div>Select a mission from the list.</div> : null}
          {!detailLoading && missionDetail ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <strong>ID:</strong> <span style={{ fontFamily: "monospace" }}>{missionDetail.id}</span>
              </div>
              <div>
                <strong>Status:</strong> {missionDetail.status}
              </div>
              <div>
                <strong>Summary:</strong> {missionDetail.summary || "-"}
              </div>
              <div>
                <strong>Operator:</strong> {missionDetail.operator_id}
              </div>
              <div>
                <strong>Version:</strong> <span style={{ fontFamily: "monospace" }}>{missionDetail.operator_version_id}</span>
              </div>
              <div>
                <strong>Source:</strong> {missionDetail.source}
              </div>
              <div>
                <strong>Trigger ID:</strong> {missionDetail.trigger_id || "-"}
              </div>
              <div>
                <strong>Approval Task ID:</strong> {missionDetail.approval_task_id || "-"}
              </div>
              <div>
                <strong>Started:</strong> {toDisplayTime(missionDetail.started_at)}
              </div>
              <div>
                <strong>Finished:</strong> {toDisplayTime(missionDetail.finished_at)}
              </div>
              <div>
                <strong>Error:</strong> {missionDetail.error || "-"}
              </div>
              <div>
                <strong>Trigger:</strong>
                <pre style={{ marginTop: 4, background: "#0b1220", color: "#d1d5db", padding: 10, borderRadius: 6, overflowX: "auto" }}>
                  {toPrettyJson(missionDetail.trigger)}
                </pre>
              </div>
              <div>
                <strong>Output</strong>
                <pre style={{ marginTop: 4, background: "#0b1220", color: "#d1d5db", padding: 10, borderRadius: 6, overflowX: "auto" }}>
                  {toPrettyJson(missionDetail.output_payload)}
                </pre>
              </div>
              <div>
                <strong>Redacted Tool Trail</strong>
                <pre style={{ marginTop: 4, background: "#0b1220", color: "#d1d5db", padding: 10, borderRadius: 6, overflowX: "auto" }}>
                  {toPrettyJson(missionDetail.tool_calls_redacted)}
                </pre>
              </div>
              <div>
                <strong>Artifacts</strong>
                <pre style={{ marginTop: 4, background: "#0b1220", color: "#d1d5db", padding: 10, borderRadius: 6, overflowX: "auto" }}>
                  {toPrettyJson(missionDetail.artifacts)}
                </pre>
              </div>
              <div>
                <strong>Audit Events</strong>
                <pre style={{ marginTop: 4, background: "#0b1220", color: "#d1d5db", padding: 10, borderRadius: 6, overflowX: "auto" }}>
                  {toPrettyJson(missionDetail.audit_events)}
                </pre>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
