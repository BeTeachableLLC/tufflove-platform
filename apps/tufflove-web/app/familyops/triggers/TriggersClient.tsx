"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Trigger = {
  id: string;
  tenant_id: string;
  operator_id: string;
  task_type: string;
  task_payload: Record<string, unknown>;
  trigger_type: "interval" | "cron" | "daily" | "weekly" | "webhook";
  config_json: Record<string, unknown>;
  enabled: boolean;
  dedupe_key: string | null;
  dedupe_window_seconds: number;
  last_fired_at: string | null;
  next_run_at: string | null;
  failure_count: number;
  last_task_id: string | null;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type TriggersClientProps = {
  operatorId: string;
};

type TriggerType = "interval" | "cron" | "daily" | "weekly" | "webhook";

const TASK_TYPES = [
  "ghl.social.plan",
  "ghl.social.schedule",
  "ghl.social.publish",
  "embed.ingest",
] as const;

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

export default function TriggersClient({ operatorId }: TriggersClientProps) {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastActionResult, setLastActionResult] = useState<unknown>(null);

  const [taskType, setTaskType] = useState<string>("ghl.social.plan");
  const [triggerType, setTriggerType] = useState<TriggerType>("interval");
  const [payloadText, setPayloadText] = useState('{"topic":"Daily strategy pulse","platforms":["fb"]}');
  const [configText, setConfigText] = useState('{"interval_seconds":300}');
  const [dedupeWindow, setDedupeWindow] = useState(300);
  const [enabled, setEnabled] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadTriggers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/familyops/triggers", { cache: "no-store" });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load triggers (${response.status})`));
      }
      const list =
        payload && typeof payload === "object" && Array.isArray((payload as { triggers?: unknown[] }).triggers)
          ? ((payload as { triggers: Trigger[] }).triggers || [])
          : [];
      setTriggers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setTriggers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTriggers();
  }, [loadTriggers]);

  async function createTrigger(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setActionError(null);
    try {
      const taskPayload = JSON.parse(payloadText) as Record<string, unknown>;
      const configJson = JSON.parse(configText) as Record<string, unknown>;
      const response = await fetch("/api/familyops/triggers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: "familyops",
          operator_id: operatorId,
          task_type: taskType,
          task_payload: taskPayload,
          trigger_type: triggerType,
          config_json: configJson,
          enabled,
          dedupe_window_seconds: dedupeWindow,
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to register trigger (${response.status})`));
      }
      setLastActionResult(payload);
      await loadTriggers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function toggleEnabled(trigger: Trigger) {
    setActionError(null);
    try {
      const response = await fetch(`/api/familyops/trigger/${encodeURIComponent(trigger.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !trigger.enabled }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to update trigger (${response.status})`));
      }
      setLastActionResult(payload);
      await loadTriggers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  async function fireTrigger(triggerId: string) {
    setActionError(null);
    try {
      const response = await fetch("/api/familyops/trigger/fire", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger_id: triggerId }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to fire trigger (${response.status})`));
      }
      setLastActionResult(payload);
      await loadTriggers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runDueTriggers() {
    setActionError(null);
    try {
      const response = await fetch("/api/familyops/trigger/fire", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ run_due: true, limit: 25 }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to run due triggers (${response.status})`));
      }
      setLastActionResult(payload);
      await loadTriggers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>FamilyOps Trigger Service</h1>
      <p style={{ color: "#9ca3af", marginBottom: 14 }}>
        Register and operate scheduled Operator missions without opening chat manually.
      </p>
      <p style={{ marginBottom: 16 }}>
        <Link href="/familyops/approvals" style={{ textDecoration: "underline" }}>
          FamilyOps Approvals
        </Link>
        {" · "}
        <Link href="/familyops/publish" style={{ textDecoration: "underline" }}>
          FamilyOps Publish Console
        </Link>
        {" · "}
        <Link href="/familyops/brands" style={{ textDecoration: "underline" }}>
          FamilyOps Brands
        </Link>
      </p>

      {error ? <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 600 }}>{error}</div> : null}
      {actionError ? <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 600 }}>{actionError}</div> : null}

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Register Trigger</h2>
        <form onSubmit={createTrigger}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "block" }}>
              <div style={{ marginBottom: 6 }}>Task Type</div>
              <select
                value={taskType}
                onChange={(event) => setTaskType(event.target.value)}
                style={{ width: "100%", padding: 10 }}
              >
                {TASK_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "block" }}>
              <div style={{ marginBottom: 6 }}>Trigger Type</div>
              <select
                value={triggerType}
                onChange={(event) => setTriggerType(event.target.value as TriggerType)}
                style={{ width: "100%", padding: 10 }}
              >
                <option value="interval">interval</option>
                <option value="cron">cron</option>
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
                <option value="webhook">webhook</option>
              </select>
            </label>
          </div>

          <label style={{ display: "block", marginTop: 10 }}>
            <div style={{ marginBottom: 6 }}>Task Payload JSON</div>
            <textarea
              rows={4}
              value={payloadText}
              onChange={(event) => setPayloadText(event.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label style={{ display: "block", marginTop: 10 }}>
            <div style={{ marginBottom: 6 }}>Config JSON</div>
            <textarea
              rows={4}
              value={configText}
              onChange={(event) => setConfigText(event.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              Dedupe window (seconds)
              <input
                type="number"
                min={1}
                value={dedupeWindow}
                onChange={(event) => setDedupeWindow(Number(event.target.value) || 300)}
                style={{ width: 120, padding: 8 }}
              />
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              Enabled
            </label>

            <button type="submit" disabled={creating} style={{ padding: "10px 14px" }}>
              {creating ? "Registering..." : "Register Trigger"}
            </button>
            <button type="button" onClick={() => void runDueTriggers()} style={{ padding: "10px 14px" }}>
              Run Due Triggers
            </button>
            <button type="button" onClick={() => void loadTriggers()} disabled={loading} style={{ padding: "10px 14px" }}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </form>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Registered Triggers</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>ID</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Task Type</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Type</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Enabled</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Next Run</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Last Fired</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((trigger) => (
                <tr key={trigger.id}>
                  <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{trigger.id}</td>
                  <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{trigger.task_type}</td>
                  <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{trigger.trigger_type}</td>
                  <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                    {trigger.enabled ? "enabled" : "disabled"}
                  </td>
                  <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{trigger.next_run_at || "-"}</td>
                  <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{trigger.last_fired_at || "-"}</td>
                  <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => void toggleEnabled(trigger)} style={{ padding: "6px 10px" }}>
                        {trigger.enabled ? "Disable" : "Enable"}
                      </button>
                      <button type="button" onClick={() => void fireTrigger(trigger.id)} style={{ padding: "6px 10px" }}>
                        Fire
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
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Last Action Result</h2>
        <pre style={{ background: "#111", color: "#f5f5f5", borderRadius: 6, padding: 12, overflowX: "auto" }}>
          {pretty(lastActionResult)}
        </pre>
      </section>
    </main>
  );
}
