"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const LABELS: Record<string, string> = {
  swot: "SWOTify Assessment",
  strengths_matrix: "Strengths Matrix Assessment",
};

export default function AssessmentGate({
  blocked,
  dueTypes,
}: {
  blocked: boolean;
  dueTypes: string[];
}) {
  const pathname = usePathname();
  const [snoozedUntil, setSnoozedUntil] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = Number(window.localStorage.getItem("assessment_snooze_until") || 0);
    if (stored > 0) setSnoozedUntil(stored);
  }, []);

  const isSnoozed = useMemo(() => snoozedUntil > Date.now(), [snoozedUntil]);

  if (!blocked) return null;
  if (pathname.startsWith("/dashboard/sitrep")) return null;
  if (isSnoozed) return null;

  const dueLabels = dueTypes.length
    ? dueTypes.map((type) => LABELS[type] || type)
    : ["Strengths Matrix Assessment", "SWOTify Assessment"];

  const handleSnooze = () => {
    if (typeof window === "undefined") return;
    const nextWeek = Date.now() + 7 * 24 * 60 * 60 * 1000;
    window.localStorage.setItem("assessment_snooze_until", String(nextWeek));
    setSnoozedUntil(nextWeek);
  };

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        backgroundColor: "#0f172a",
        color: "#fff",
        padding: "16px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, marginBottom: "4px" }}>Intel required</div>
          <div style={{ color: "#cbd5f5", fontSize: "14px" }}>
            Please complete within 30 days. Required: {dueLabels.join(", ")}.
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleSnooze}
            style={{
              backgroundColor: "transparent",
              color: "#e2e8f0",
              border: "1px solid rgba(226,232,240,0.4)",
              padding: "8px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Remind me in 7 days
          </button>
          <Link
            href="/dashboard/sitrep"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#2563eb",
              color: "#fff",
              padding: "8px 14px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Go to Intel →
          </Link>
        </div>
      </div>
    </div>
  );
}
