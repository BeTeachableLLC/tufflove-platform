"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type OperatorSummary = {
  operator_id: string;
  version_count: number;
  active_version_id: string | null;
  active_version_number: number | null;
  updated_at: string | null;
};

type OperatorVersion = {
  id: string;
  tenant_id: string;
  operator_id: string;
  version_number: number;
  version_label: string | null;
  status: "draft" | "validated" | "active" | "archived";
  goal: string;
  instruction_json: Record<string, unknown>;
  tool_manifest: string[];
  validation_summary: string;
  validation_status: "pending" | "passed" | "failed";
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
  latest_runner_instruction?: {
    instruction_json: Record<string, unknown>;
    tool_manifest: string[];
    checksum: string;
    created_at: string | null;
  } | null;
  forge_build_count?: number;
};

type OperatorMission = {
  id: string;
  tenant_id: string;
  user_id: string;
  operator_id: string;
  operator_version_id: string;
  status: string;
  summary: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  redacted_tool_log: unknown[];
  token_estimate: number;
  cost_estimate: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
};

type OperatorsClientProps = {
  createdBy: string;
};

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

function pretty(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const DEFAULT_INSTRUCTION = {
  steps: [
    {
      tool: "db.read",
      payload: { objective: "collect latest context for the operator mission" },
    },
  ],
};

export default function OperatorsClient({ createdBy }: OperatorsClientProps) {
  const [operators, setOperators] = useState<OperatorSummary[]>([]);
  const [operatorsLoading, setOperatorsLoading] = useState(false);
  const [operatorsError, setOperatorsError] = useState<string | null>(null);

  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [versions, setVersions] = useState<OperatorVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);

  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [versionDetails, setVersionDetails] = useState<OperatorVersion | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [mission, setMission] = useState<OperatorMission | null>(null);
  const [missionError, setMissionError] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);

  const [createOperatorId, setCreateOperatorId] = useState("familyops-default");
  const [createGoal, setCreateGoal] = useState("Daily operator mission");
  const [createStatus, setCreateStatus] = useState<"draft" | "validated" | "active">("draft");
  const [createValidationStatus, setCreateValidationStatus] = useState<"pending" | "passed" | "failed">("pending");
  const [createToolManifest, setCreateToolManifest] = useState("db.read");
  const [createInstruction, setCreateInstruction] = useState(JSON.stringify(DEFAULT_INSTRUCTION, null, 2));
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [lastActionResult, setLastActionResult] = useState<unknown>(null);

  const selectedOperator = useMemo(
    () => operators.find((item) => item.operator_id === selectedOperatorId) ?? null,
    [operators, selectedOperatorId],
  );

  const loadOperators = useCallback(async () => {
    setOperatorsLoading(true);
    setOperatorsError(null);
    try {
      const response = await fetch("/api/familyops/operators", { cache: "no-store" });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load operators (${response.status})`));
      }
      const records =
        payload && typeof payload === "object" && Array.isArray((payload as { operators?: unknown[] }).operators)
          ? ((payload as { operators: OperatorSummary[] }).operators || [])
          : [];
      setOperators(records);
      if (!selectedOperatorId && records.length > 0) {
        setSelectedOperatorId(records[0].operator_id);
      }
    } catch (error) {
      setOperatorsError(error instanceof Error ? error.message : String(error));
      setOperators([]);
    } finally {
      setOperatorsLoading(false);
    }
  }, [selectedOperatorId]);

  const loadVersions = useCallback(async (operatorId: string) => {
    const id = operatorId.trim();
    if (!id) {
      setVersions([]);
      return;
    }
    setVersionsLoading(true);
    setVersionsError(null);
    try {
      const response = await fetch(`/api/familyops/operator/${encodeURIComponent(id)}/versions`, {
        cache: "no-store",
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load versions (${response.status})`));
      }
      const records =
        payload && typeof payload === "object" && Array.isArray((payload as { versions?: unknown[] }).versions)
          ? ((payload as { versions: OperatorVersion[] }).versions || [])
          : [];
      setVersions(records);
      if (!selectedVersionId && records.length > 0) {
        setSelectedVersionId(records[0].id);
      }
    } catch (error) {
      setVersionsError(error instanceof Error ? error.message : String(error));
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }, [selectedVersionId]);

  const loadVersionDetails = useCallback(async (versionId: string) => {
    const id = versionId.trim();
    if (!id) {
      setVersionDetails(null);
      return;
    }
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const response = await fetch(`/api/familyops/operator/version/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load version details (${response.status})`));
      }
      setVersionDetails(payload as OperatorVersion);
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : String(error));
      setVersionDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOperators();
  }, [loadOperators]);

  useEffect(() => {
    if (!selectedOperatorId) return;
    void loadVersions(selectedOperatorId);
  }, [loadVersions, selectedOperatorId]);

  useEffect(() => {
    if (!selectedVersionId) return;
    void loadVersionDetails(selectedVersionId);
  }, [loadVersionDetails, selectedVersionId]);

  async function createVersion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    setMissionError(null);
    try {
      const instructionJson = JSON.parse(createInstruction) as Record<string, unknown>;
      const toolManifest = createToolManifest
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const response = await fetch("/api/familyops/operator/version", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: "familyops",
          operator_id: createOperatorId.trim(),
          status: createStatus,
          goal: createGoal,
          instruction_json: instructionJson,
          tool_manifest: toolManifest,
          validation_summary: createValidationStatus === "passed" ? "Validated by admin" : "",
          validation_status: createValidationStatus,
          created_by: createdBy,
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to create operator version (${response.status})`));
      }
      setLastActionResult(payload);
      const version =
        payload && typeof payload === "object" && "version" in payload
          ? ((payload as { version: OperatorVersion }).version || null)
          : null;
      await loadOperators();
      if (version?.operator_id) {
        setSelectedOperatorId(version.operator_id);
        await loadVersions(version.operator_id);
      }
      if (version?.id) {
        setSelectedVersionId(version.id);
        await loadVersionDetails(version.id);
      }
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreateLoading(false);
    }
  }

  async function activateVersion(versionId: string) {
    setMissionError(null);
    setCreateError(null);
    try {
      const response = await fetch(`/api/familyops/operator/version/${encodeURIComponent(versionId)}/activate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activated_by: createdBy }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to activate version (${response.status})`));
      }
      setLastActionResult(payload);
      if (selectedOperatorId) {
        await loadVersions(selectedOperatorId);
      }
      await loadVersionDetails(versionId);
      await loadOperators();
    } catch (error) {
      setMissionError(error instanceof Error ? error.message : String(error));
    }
  }

  async function runSelectedVersion(versionId: string) {
    setRunLoading(true);
    setMissionError(null);
    try {
      const response = await fetch("/api/familyops/operator/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: "familyops",
          user_id: createdBy,
          operator_version_id: versionId,
          input_payload: { message: "Run selected operator version" },
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to run version (${response.status})`));
      }
      setLastActionResult(payload);
      const missionId =
        payload && typeof payload === "object" && typeof (payload as { mission?: { id?: unknown } }).mission?.id === "string"
          ? String((payload as { mission: { id: string } }).mission.id)
          : "";
      if (!missionId) return;
      const missionResponse = await fetch(`/api/familyops/operator/mission/${encodeURIComponent(missionId)}`, {
        cache: "no-store",
      });
      const missionPayload = await readResponse(missionResponse);
      if (!missionResponse.ok) {
        throw new Error(parseError(missionPayload, `Failed to load mission (${missionResponse.status})`));
      }
      setMission(missionPayload as OperatorMission);
    } catch (error) {
      setMissionError(error instanceof Error ? error.message : String(error));
      setMission(null);
    } finally {
      setRunLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 1260, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>FamilyOps Operators</h1>
      <p style={{ color: "#9ca3af", marginBottom: 12 }}>
        Forge operator versions and run version-bound deterministic missions through Runner.
      </p>
      <p style={{ marginBottom: 16 }}>
        <Link href="/familyops/approvals" style={{ textDecoration: "underline" }}>
          FamilyOps Approvals
        </Link>
        {" · "}
        <Link href="/familyops/triggers" style={{ textDecoration: "underline" }}>
          FamilyOps Triggers
        </Link>
      </p>

      {operatorsError ? <div style={{ color: "#ef4444", marginBottom: 10, fontWeight: 600 }}>{operatorsError}</div> : null}
      {versionsError ? <div style={{ color: "#ef4444", marginBottom: 10, fontWeight: 600 }}>{versionsError}</div> : null}
      {detailsError ? <div style={{ color: "#ef4444", marginBottom: 10, fontWeight: 600 }}>{detailsError}</div> : null}
      {createError ? <div style={{ color: "#ef4444", marginBottom: 10, fontWeight: 600 }}>{createError}</div> : null}
      {missionError ? <div style={{ color: "#ef4444", marginBottom: 10, fontWeight: 600 }}>{missionError}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Operators</h2>
          <button type="button" onClick={() => void loadOperators()} disabled={operatorsLoading} style={{ padding: "8px 12px", marginBottom: 10 }}>
            {operatorsLoading ? "Refreshing..." : "Refresh Operators"}
          </button>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Operator</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Active</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Versions</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((operator) => (
                  <tr
                    key={operator.operator_id}
                    style={{
                      background: selectedOperatorId === operator.operator_id ? "#111827" : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedOperatorId(operator.operator_id)}
                  >
                    <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{operator.operator_id}</td>
                    <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                      {operator.active_version_number ? `v${operator.active_version_number}` : "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{operator.version_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Create Version (Forge)</h2>
          <form onSubmit={createVersion}>
            <label style={{ display: "block", marginBottom: 8 }}>
              Operator ID
              <input
                value={createOperatorId}
                onChange={(event) => setCreateOperatorId(event.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <label style={{ display: "block", marginBottom: 8 }}>
              Goal
              <input
                value={createGoal}
                onChange={(event) => setCreateGoal(event.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ display: "block", marginBottom: 8 }}>
                Status
                <select
                  value={createStatus}
                  onChange={(event) => setCreateStatus(event.target.value as "draft" | "validated" | "active")}
                  style={{ width: "100%", padding: 8, marginTop: 4 }}
                >
                  <option value="draft">draft</option>
                  <option value="validated">validated</option>
                  <option value="active">active</option>
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                Validation
                <select
                  value={createValidationStatus}
                  onChange={(event) => setCreateValidationStatus(event.target.value as "pending" | "passed" | "failed")}
                  style={{ width: "100%", padding: 8, marginTop: 4 }}
                >
                  <option value="pending">pending</option>
                  <option value="passed">passed</option>
                  <option value="failed">failed</option>
                </select>
              </label>
            </div>
            <label style={{ display: "block", marginBottom: 8 }}>
              Tool Manifest (comma-separated)
              <input
                value={createToolManifest}
                onChange={(event) => setCreateToolManifest(event.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <label style={{ display: "block", marginBottom: 8 }}>
              Instruction JSON
              <textarea
                rows={6}
                value={createInstruction}
                onChange={(event) => setCreateInstruction(event.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <button type="submit" disabled={createLoading} style={{ padding: "10px 14px" }}>
              {createLoading ? "Creating..." : "Create Version"}
            </button>
          </form>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>
            Versions {selectedOperator ? `for ${selectedOperator.operator_id}` : ""}
          </h2>
          {versionsLoading ? <div>Loading versions...</div> : null}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Version</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Status</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Validation</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr
                    key={version.id}
                    style={{
                      background: selectedVersionId === version.id ? "#111827" : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedVersionId(version.id)}
                  >
                    <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                      v{version.version_number} {version.version_label ? `(${version.version_label})` : ""}
                    </td>
                    <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{version.status}</td>
                    <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{version.validation_status}</td>
                    <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => void activateVersion(version.id)} style={{ padding: "6px 10px" }}>
                          Activate
                        </button>
                        <button type="button" onClick={() => void runSelectedVersion(version.id)} disabled={runLoading} style={{ padding: "6px 10px" }}>
                          {runLoading ? "Running..." : "Run"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Selected Version Detail</h2>
          {detailsLoading ? <div>Loading version detail...</div> : null}
          <pre style={{ background: "#111", color: "#f5f5f5", borderRadius: 6, padding: 12, minHeight: 160, overflowX: "auto" }}>
            {pretty(versionDetails)}
          </pre>
          <h3 style={{ marginTop: 10, marginBottom: 6, fontSize: 16 }}>Last Mission</h3>
          <pre style={{ background: "#111", color: "#f5f5f5", borderRadius: 6, padding: 12, minHeight: 120, overflowX: "auto" }}>
            {pretty(mission)}
          </pre>
          <h3 style={{ marginTop: 10, marginBottom: 6, fontSize: 16 }}>Last Action Result</h3>
          <pre style={{ background: "#111", color: "#f5f5f5", borderRadius: 6, padding: 12, minHeight: 120, overflowX: "auto" }}>
            {pretty(lastActionResult)}
          </pre>
        </section>
      </div>
    </main>
  );
}
