"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { chat, enqueueFamilyTask, runWorkerOnce } from "@/src/lib/agentClient";

const FAMILYOPS_TASK_TYPES = [
  "ghl.social.plan",
  "ghl.social.schedule",
  "ghl.social.publish",
  "embed.ingest",
] as const;

function pretty(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeMarkdownForDisplay(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)")
    .trim();
}

export default function AgentTestPage() {
  const [message, setMessage] = useState("Build me a plan.");
  const [chatResult, setChatResult] = useState<unknown>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  const [taskType, setTaskType] = useState<string>(FAMILYOPS_TASK_TYPES[0]);
  const [taskPayload, setTaskPayload] = useState(
    '{"topic":"TUFF LOVE daily post","platforms":["fb","ig"]}',
  );
  const [taskResult, setTaskResult] = useState<unknown>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [workerResult, setWorkerResult] = useState<unknown>(null);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [workerLoading, setWorkerLoading] = useState(false);
  const chatData = asRecord(chatResult);
  const answerRaw = typeof chatData?.answer === "string" ? chatData.answer : "";
  const answerDisplay = answerRaw ? normalizeMarkdownForDisplay(answerRaw) : "";
  const aiMode = typeof chatData?.ai_mode === "string" ? chatData.ai_mode : null;
  const aiError = typeof chatData?.ai_error === "string" ? chatData.ai_error : null;

  async function onChatSubmit(event: FormEvent<HTMLFormElement>) {
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

  async function onTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTaskError(null);
    setTaskLoading(true);
    try {
      const parsedPayload = JSON.parse(taskPayload || "{}");
      if (!FAMILYOPS_TASK_TYPES.includes(taskType as (typeof FAMILYOPS_TASK_TYPES)[number])) {
        throw new Error(
          `Invalid task type. Use one of: ${FAMILYOPS_TASK_TYPES.join(", ")}`,
        );
      }
      const data = await enqueueFamilyTask(taskType, parsedPayload);
      setTaskResult(data);
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : String(error));
    } finally {
      setTaskLoading(false);
    }
  }

  async function onWorkerRunOnce() {
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

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Agent Test</h1>
      <p style={{ marginBottom: 8 }}>
        <Link href="/familyops/approvals" style={{ textDecoration: "underline" }}>
          FamilyOps Approvals
        </Link>
      </p>
      <p style={{ marginBottom: 24 }}>
        Sends requests to <code>/v1/chat</code> and <code>/v1/task/enqueue</code> on the ZeroClaw
        API.
      </p>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Chat Test (tufflove)</h2>
        <form onSubmit={onChatSubmit}>
          <label htmlFor="message" style={{ display: "block", marginBottom: 8 }}>
            Message
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            style={{ width: "100%", padding: 12, marginBottom: 12 }}
          />
          <button
            type="submit"
            disabled={chatLoading}
            style={{ padding: "10px 14px", cursor: chatLoading ? "not-allowed" : "pointer" }}
          >
            {chatLoading ? "Sending..." : "Send Chat"}
          </button>
        </form>
        {chatError ? <p style={{ color: "#b00020", marginTop: 12 }}>{chatError}</p> : null}
        {answerDisplay ? (
          <div
            style={{
              marginTop: 12,
              background: "#111",
              color: "#f5f5f5",
              borderRadius: 6,
              padding: 12,
              minHeight: 72,
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
            }}
          >
            {answerDisplay}
          </div>
        ) : (
          <div
            style={{
              marginTop: 12,
              background: "#111",
              color: "#9ca3af",
              borderRadius: 6,
              padding: 12,
              minHeight: 72,
            }}
          >
            No response yet.
          </div>
        )}
        {aiMode ? (
          <p style={{ marginTop: 8, fontSize: 13, color: aiMode === "live" ? "#16a34a" : "#f59e0b" }}>
            AI mode: {aiMode}
          </p>
        ) : null}
        {aiError ? <p style={{ marginTop: 4, fontSize: 13, color: "#f59e0b" }}>{aiError}</p> : null}
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", color: "#9ca3af" }}>Show raw JSON</summary>
          <pre
            style={{
              marginTop: 8,
              background: "#111",
              color: "#f5f5f5",
              borderRadius: 6,
              padding: 12,
              minHeight: 72,
              overflowX: "auto",
            }}
          >
            {pretty(chatResult)}
          </pre>
        </details>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
          FamilyOps Task Enqueue Test
        </h2>
        <p style={{ marginBottom: 12, color: "#9ca3af", fontSize: 14 }}>
          Only allowed FamilyOps task types can be queued. This endpoint enqueues work; worker
          execution happens separately.
        </p>
        <form onSubmit={onTaskSubmit}>
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
            rows={5}
            style={{ width: "100%", padding: 12, marginBottom: 12 }}
          />

          <button
            type="submit"
            disabled={taskLoading}
            style={{ padding: "10px 14px", cursor: taskLoading ? "not-allowed" : "pointer" }}
          >
            {taskLoading ? "Queueing..." : "Enqueue Family Task"}
          </button>
          <button
            type="button"
            onClick={onWorkerRunOnce}
            disabled={workerLoading}
            style={{
              padding: "10px 14px",
              cursor: workerLoading ? "not-allowed" : "pointer",
              marginLeft: 10,
            }}
          >
            {workerLoading ? "Running..." : "Run Worker Once"}
          </button>
        </form>

        {taskError ? (
          <div
            style={{
              marginTop: 12,
              background: "#7f1d1d",
              color: "#fee2e2",
              borderRadius: 6,
              padding: 10,
              fontWeight: 600,
            }}
          >
            Task error: {taskError}
          </div>
        ) : null}
        {workerError ? (
          <div
            style={{
              marginTop: 12,
              background: "#7f1d1d",
              color: "#fee2e2",
              borderRadius: 6,
              padding: 10,
              fontWeight: 600,
            }}
          >
            Worker error: {workerError}
          </div>
        ) : null}
        <pre
          style={{
            marginTop: 12,
            background: "#111",
            color: "#f5f5f5",
            borderRadius: 6,
            padding: 12,
            minHeight: 72,
            overflowX: "auto",
          }}
        >
          {pretty(taskResult)}
        </pre>
        <pre
          style={{
            marginTop: 12,
            background: "#111",
            color: "#f5f5f5",
            borderRadius: 6,
            padding: 12,
            minHeight: 72,
            overflowX: "auto",
          }}
        >
          {pretty(workerResult)}
        </pre>
      </section>
    </main>
  );
}
