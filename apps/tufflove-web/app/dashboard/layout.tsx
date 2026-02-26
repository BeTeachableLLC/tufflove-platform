import Sidebar from "@/components/sidebar";
import AssessmentGate from "@/components/assessments/AssessmentGate";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const STALE_MS = 180 * 24 * 60 * 60 * 1000;
const ASSESSMENT_TYPES = ["swot", "strengths_matrix"] as const;
const NOW_MS = Date.now();

type AssessmentRun = {
  assessment_type: string;
  completed_at: string | null;
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const isPaid =
      user.app_metadata?.is_paid === true ||
      user.user_metadata?.is_paid === true;

    if (!isPaid) {
      const marketingUrl =
        process.env.NEXT_PUBLIC_MARKETING_URL ??
        (process.env.NODE_ENV === "development"
          ? "http://localhost:3000"
          : "https://tufflove.us");
      redirect(`${marketingUrl}/#pricing`);
    }
  }

  let blocked = false;
  let dueTypes: string[] = [];

  if (user) {
    const { data: runs, error } = await supabase
      .from("assessment_runs")
      .select("assessment_type, completed_at")
      .eq("user_id", user.id)
      .in("assessment_type", [...ASSESSMENT_TYPES])
      .order("completed_at", { ascending: false });

    if (!error) {
      const latest: Record<string, string | null> = {
        swot: null,
        strengths_matrix: null,
      };

      ((runs || []) as AssessmentRun[]).forEach((run) => {
        if (!latest[run.assessment_type]) {
          latest[run.assessment_type] = run.completed_at;
        }
      });

      const now = NOW_MS;
      dueTypes = ASSESSMENT_TYPES.filter((type) => {
        const lastRun = latest[type];
        if (!lastRun) return true;
        const lastTime = new Date(lastRun).getTime();
        return now - lastTime > STALE_MS;
      });
      blocked = dueTypes.length > 0;
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#000" }}>
      <Sidebar />
      <main style={{ flex: 1, maxHeight: "100vh", overflowY: "auto" }}>
        <AssessmentGate blocked={blocked} dueTypes={dueTypes} />
        {children}
      </main>
    </div>
  );
}
