"use client";

import { FormEvent, useMemo, useState } from "react";
import { chat, enqueueFamilyTask, runWorkerOnce } from "@/src/lib/agentClient";

const FAMILYOPS_TASK_TYPES = [
  "ghl.social.plan",
  "ghl.social.schedule",
  "ghl.social.publish",
  "embed.ingest",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pretty(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeAnswer(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export default function AgentPage() {
  const [message, setMessage] = useState("Build me a weekly execution plan for TUFF LOVE.");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatResult, setChatResult] = useState<unknown>(null);

  const [taskType, setTaskType] = useState<string>("ghl.social.plan");
  const [taskPayload, setTaskPayload] = useState(
    '{"topic":"TUFF LOVE daily post","platforms":["fb","ig"],"timezone":"America/Chicago"}',
  );
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueResult, setQueueResult] = useState<unknown>(null);

  const [workerLoading, setWorkerLoading] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [workerResult, setWorkerResult] = useState<unknown>(null);

  const answer = useMemo(() => {
    const chatData = asRecord(chatResult);
    const answerRaw = typeof chatData?.answer === "string" ? chatData.answer : "";
    if (!answerRaw) return "";
    return normalizeAnswer(answerRaw);
  }, [chatResult]);

  async function onChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChatError(null);
    setChatLoading(true);
    try {
      const data = await chat(message);
      setChatResult(data);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : String(error));
    } finally {
      setChatLoading(false);
    }
  }

  async function onQueue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQueueError(null);
    setQueueLoading(true);
    try {
      const payload = JSON.parse(taskPayload || "{}");
      const data = await enqueueFamilyTask(taskType, payload);
      setQueueResult(data);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : String(error));
    } finally {
      setQueueLoading(false);
    }
  }

  async function onRunWorker() {
    setWorkerError(null);
    setWorkerLoading(true);
    try {
      const data = await runWorkerOnce();
      setWorkerResult(data);
    } catch (error) {
      setWorkerError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorkerLoading(false);
    }
  }

  async function onQueueAndRun() {
    setWorkerError(null);
    setQueueError(null);
    setQueueLoading(true);
    setWorkerLoading(true);
    try {
      const payload = JSON.parse(taskPayload || "{}");
      const queued = await enqueueFamilyTask(taskType, payload);
      setQueueResult(queued);
      const ran = await runWorkerOnce();
      setWorkerResult(ran);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setQueueError(msg);
      setWorkerError(msg);
    } finally {
      setQueueLoading(false);
      setWorkerLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>Agent Operations</h1>
      <p style={{ marginBottom: 24, color: "#9ca3af" }}>
        Production workflow: chat, enqueue FamilyOps task, run worker, inspect output.
      </p>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 10 }}>1) Strategy Chat</h2>
        <form onSubmit={onChat}>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            style={{ width: "100%", padding: 12, marginBottom: 12 }}
          />
          <button type="submit" disabled={chatLoading} style={{ padding: "10px 14px" }}>
            {chatLoading ? "Thinking..." : "Run Chat"}
          </button>
        </form>
        {chatError ? <div style={{ marginTop: 10, color: "#ef4444" }}>{chatError}</div> : null}
        <div
          style={{
            marginTop: 12,
            background: "#111",
            color: "#f5f5f5",
            borderRadius: 6,
            padding: 12,
            minHeight: 120,
            whiteSpace: "pre-wrap",
            lineHeight: 1.5,
          }}
        >
          {answer || "No response yet."}
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 10 }}>2) FamilyOps Task Flow</h2>
        <form onSubmit={onQueue}>
          <label htmlFor="taskType" style={{ display: "block", marginBottom: 8 }}>
            Task Type
          </label>
          <select
            id="taskType"
            value={taskType}
            onChange={(event) => setTaskType(event.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 12 }}
          >
            {FAMILYOPS_TASK_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <label htmlFor="taskPayload" style={{ display: "block", marginBottom: 8 }}>
            Payload (JSON)
          </label>
          <textarea
            id="taskPayload"
            value={taskPayload}
            onChange={(event) => setTaskPayload(event.target.value)}
            rows={6}
            style={{ width: "100%", padding: 12, marginBottom: 12 }}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="submit" disabled={queueLoading} style={{ padding: "10px 14px" }}>
              {queueLoading ? "Queueing..." : "Enqueue Task"}
            </button>
            <button type="button" onClick={onRunWorker} disabled={workerLoading} style={{ padding: "10px 14px" }}>
              {workerLoading ? "Running..." : "Run Worker Once"}
            </button>
            <button
              type="button"
              onClick={onQueueAndRun}
              disabled={queueLoading || workerLoading}
              style={{ padding: "10px 14px" }}
            >
              Queue + Run
            </button>
          </div>
        </form>

        {queueError ? <div style={{ marginTop: 10, color: "#ef4444" }}>Queue error: {queueError}</div> : null}
        {workerError ? <div style={{ marginTop: 10, color: "#ef4444" }}>Worker error: {workerError}</div> : null}

        <h3 style={{ marginTop: 14, marginBottom: 8 }}>Queue Result</h3>
        <pre style={{ background: "#111", color: "#f5f5f5", borderRadius: 6, padding: 12, overflowX: "auto" }}>
          {pretty(queueResult)}
        </pre>

        <h3 style={{ marginTop: 14, marginBottom: 8 }}>Worker Result</h3>
        <pre style={{ background: "#111", color: "#f5f5f5", borderRadius: 6, padding: 12, overflowX: "auto" }}>
          {pretty(workerResult)}
        </pre>
      </section>
    </main>
  );
}
