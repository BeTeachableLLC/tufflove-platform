import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createLevel10MeetingInstanceAction, createLevel10SeriesAction } from "@/app/actions";

export const dynamic = "force-dynamic";

type MeetingInstance = {
  id: string;
  scheduled_for: string;
  status: string;
};

type MeetingSeries = {
  id: string;
  title: string;
  cadence: string;
  timezone: string;
};

export default async function Level10CompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  const { companyId } = await params;

  const { data: company } = await supabase.from("companies").select("id, name").eq("id", companyId).single();
  if (!company) redirect("/dashboard/level10");

  const { data: series } = await supabase
    .from("level10_meeting_series")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const { data: meetings } = await supabase
    .from("level10_meeting_instances")
    .select("id, series_id, scheduled_for, status")
    .eq("company_id", companyId)
    .order("scheduled_for", { ascending: false })
    .limit(10);

  return (
    <div style={{ padding: "40px", backgroundColor: "#F3F4F6", minHeight: "100vh", color: "#111827" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <div style={{ marginBottom: "24px" }}>
          <Link href="/dashboard/level10" style={{ color: "#6B7280", fontSize: "12px", textDecoration: "none" }}>
            ← Back to Level 10
          </Link>
          <h1 style={{ fontSize: "28px", margin: "10px 0 4px 0" }}>{company.name}</h1>
          <p style={{ color: "#6B7280", fontSize: "14px", margin: 0 }}>
            Weekly Level 10 cadence and accountability.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginTop: 0, fontSize: "16px" }}>Create Meeting Series</h3>
            <form action={createLevel10SeriesAction.bind(null, companyId)} style={{ display: "grid", gap: "12px" }}>
              <input
                name="title"
                placeholder="Weekly Level 10"
                required
                style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <select name="cadence" defaultValue="weekly" style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <input
                  name="timezone"
                  placeholder="Timezone (e.g., America/New_York)"
                  defaultValue="UTC"
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
                />
              </div>
              <button style={{ backgroundColor: "#111827", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 18px", fontWeight: 600 }}>
                Add Series
              </button>
            </form>
          </div>

          <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginTop: 0, fontSize: "16px" }}>Recent Meetings</h3>
            <div style={{ display: "grid", gap: "10px" }}>
              {((meetings || []) as MeetingInstance[]).map((meeting) => (
                <div key={meeting.id} style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>{new Date(meeting.scheduled_for).toLocaleString()}</div>
                  <div style={{ fontSize: "12px", color: "#6B7280" }}>Status: {meeting.status}</div>
                </div>
              ))}
              {(!meetings || meetings.length === 0) && (
                <div style={{ fontSize: "13px", color: "#6B7280" }}>No meetings yet.</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "24px", backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
          <h3 style={{ marginTop: 0, fontSize: "16px" }}>Meeting Series</h3>
          <div style={{ display: "grid", gap: "12px" }}>
            {((series || []) as MeetingSeries[]).map((item) => (
              <div key={item.id} style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  <div style={{ fontSize: "12px", color: "#6B7280" }}>{item.cadence} · {item.timezone}</div>
                </div>
                <form action={createLevel10MeetingInstanceAction.bind(null, companyId, item.id)}>
                  <button style={{ backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 14px", fontWeight: 600 }}>
                    Start Meeting
                  </button>
                </form>
              </div>
            ))}
            {(!series || series.length === 0) && (
              <div style={{ fontSize: "13px", color: "#6B7280" }}>Create your first meeting series to start tracking scorecards and rocks.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
