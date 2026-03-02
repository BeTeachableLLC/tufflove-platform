"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type GhlStatus = {
  connected?: boolean;
  location_id?: string | null;
  expires_at?: string | null;
  connections?: Array<{
    location_id: string;
    status: string;
    expires_at: string | null;
  }>;
};

type ApiError = {
  error?: string;
  detail?: string;
};

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

function asError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const data = payload as ApiError;
    if (data.error) return data.error;
    if (data.detail) return data.detail;
  }
  return fallback;
}

export default function GhlConnectClient() {
  const [status, setStatus] = useState<GhlStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ghl/status", { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok) {
        throw new Error(asError(payload, `Status request failed (${response.status})`));
      }
      setStatus((payload as GhlStatus) || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function onConnectClick() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ghl/start", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await readJson(response);
      if (!response.ok) {
        throw new Error(asError(payload, `Failed to start OAuth (${response.status})`));
      }
      const authUrl =
        payload && typeof payload === "object" && "auth_url" in payload
          ? String((payload as { auth_url?: unknown }).auth_url || "")
          : "";
      if (!authUrl) {
        throw new Error("OAuth start response did not include auth_url.");
      }
      window.location.assign(authUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>FamilyOps GHL</h1>
      <p style={{ marginBottom: 10, color: "#9ca3af" }}>
        Connect FamilyOps to GoHighLevel OAuth. Publish remains approval-gated and dry-run only.
      </p>
      <p style={{ marginBottom: 20 }}>
        <Link href="/familyops/approvals" style={{ textDecoration: "underline" }}>
          Go to FamilyOps Approvals
        </Link>
        {" · "}
        <Link href="/familyops/brands" style={{ textDecoration: "underline" }}>
          Go to FamilyOps Brands
        </Link>
      </p>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <strong>Connection status:</strong>{" "}
          {statusLoading ? "Checking..." : status?.connected ? "Connected" : "Not connected"}
        </div>
        {status?.connected ? (
          <div style={{ marginBottom: 12, color: "#9ca3af", fontSize: 14 }}>
            {Array.isArray(status.connections) && status.connections.length > 0 ? (
              status.connections.map((conn) => (
                <div key={conn.location_id}>
                  Location: {conn.location_id} | Status: {conn.status} | Expires: {conn.expires_at || "n/a"}
                </div>
              ))
            ) : (
              <>
                <div>Location ID: {status.location_id || "n/a"}</div>
                <div>Token Expires At: {status.expires_at || "n/a"}</div>
              </>
            )}
          </div>
        ) : null}
        {error ? (
          <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 600 }}>{error}</div>
        ) : null}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => void onConnectClick()}
            disabled={loading}
            style={{ padding: "10px 14px", cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Redirecting..." : "Connect GoHighLevel"}
          </button>
          <button
            type="button"
            onClick={() => void loadStatus()}
            disabled={statusLoading}
            style={{ padding: "10px 14px", cursor: statusLoading ? "not-allowed" : "pointer" }}
          >
            {statusLoading ? "Refreshing..." : "Refresh Status"}
          </button>
        </div>
      </section>
    </main>
  );
}
