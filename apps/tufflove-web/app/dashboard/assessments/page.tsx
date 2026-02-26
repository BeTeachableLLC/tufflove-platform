import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const ASSESSMENTS = [
  {
    key: "strengths_matrix",
    name: "Strengths Matrix Assessment",
    href: "/dashboard/assessments/strengths",
    description:
      "A 60-question, three-part assessment that surfaces strengths, weaknesses, needs, and personality traits. It clarifies how you operate under pressure and at your best, then maps your dominant style using four color profiles (red, yellow, blue, green) to improve communication and teamwork.",
  },
  {
    key: "swot",
    name: "SWOTify Assessment",
    href: "/dashboard/assessments/swot",
    description:
      "A guided SWOT that walks you through targeted questions across your business. You answer yes/no/unsure and receive a clear Strengths, Weaknesses, Opportunities, and Threats snapshot with actionable feedback.",
  },
];

const STALE_MS = 180 * 24 * 60 * 60 * 1000;
const NOW_MS = Date.now();

type AssessmentRun = {
  assessment_type: string;
  completed_at: string | null;
};

export default async function AssessmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  const { data: runs } = await supabase
    .from("assessment_runs")
    .select("assessment_type, completed_at")
    .eq("user_id", user.id)
    .in("assessment_type", ASSESSMENTS.map((item) => item.key))
    .order("completed_at", { ascending: false });

  const latestByType: Record<string, string | null> = {
    swot: null,
    strengths_matrix: null,
  };

  ((runs || []) as AssessmentRun[]).forEach((run) => {
    if (!latestByType[run.assessment_type]) {
      latestByType[run.assessment_type] = run.completed_at;
    }
  });

  const now = NOW_MS;

  return (
    <div style={{ padding: "40px", backgroundColor: "#F3F4F6", minHeight: "100vh", color: "#111827" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "28px", margin: 0 }}>Intel</h1>
          <p style={{ color: "#6B7280", marginTop: "6px" }}>
            Complete these every 180 days to keep access active.
          </p>
        </div>

        <div style={{ display: "grid", gap: "16px" }}>
          {ASSESSMENTS.map((assessment) => {
            const lastRun = latestByType[assessment.key];
            const lastTime = lastRun ? new Date(lastRun).getTime() : null;
            const isStale = !lastTime || now - lastTime > STALE_MS;
            const daysAgo = lastTime ? Math.floor((now - lastTime) / (24 * 60 * 60 * 1000)) : null;
            const statusLabel = lastRun
              ? isStale
                ? "Due"
                : "Complete"
              : "Not started";

            return (
              <div
                key={assessment.key}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "14px",
                  border: "1px solid #E5E7EB",
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 700 }}>{assessment.name}</div>
                  <div style={{ fontSize: "14px", color: "#374151", marginTop: "8px", maxWidth: "680px" }}>
                    {assessment.description}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6B7280", marginTop: "4px" }}>
                    {lastRun
                      ? `Last completed ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`
                      : "No completion recorded yet"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <span
                    style={{
                      padding: "6px 12px",
                      borderRadius: "999px",
                      backgroundColor: isStale ? "#FEE2E2" : "#DCFCE7",
                      color: isStale ? "#991B1B" : "#166534",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {statusLabel}
                  </span>
                  <Link
                    href={assessment.href}
                    style={{
                      textDecoration: "none",
                      fontWeight: 600,
                      color: "#2563eb",
                    }}
                  >
                    Open →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
