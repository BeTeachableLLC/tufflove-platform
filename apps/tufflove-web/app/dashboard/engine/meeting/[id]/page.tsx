import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  
  // Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  // 1. Safe Params Handling (Next.js 15)
  const { id } = await params;

  // 2. Fetch Meeting Data
  const { data: meeting, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !meeting) {
    return (
      <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
        <h1>🚫 Meeting Not Found</h1>
        <p>This meeting may have been deleted.</p>
        <Link href="/dashboard/engine" style={{ color: "blue" }}>← Back to Pitch Engine</Link>
      </div>
    );
  }

  // 3. Safe JSON Parsing for AI Data
  let analysis = null;
  try {
    if (meeting.ai_analysis && typeof meeting.ai_analysis === 'string') {
      analysis = JSON.parse(meeting.ai_analysis);
    } else if (meeting.ai_analysis && typeof meeting.ai_analysis === 'object') {
      analysis = meeting.ai_analysis;
    }
  } catch (e) {
    console.error("Error parsing AI analysis:", e);
  }

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "900px", margin: "0 auto", paddingBottom: "50px", color: "#333" }}>
      
      {/* HEADER */}
      <div style={{ marginBottom: "20px" }}>
        <Link href="/dashboard/engine" style={{ color: "gray", textDecoration: "none", fontSize: "12px" }}>← Back to Pitch Engine</Link>
        <h1 style={{ marginTop: "10px", marginBottom: "5px", color: "black" }}>{meeting.title || "Untitled Meeting"}</h1>
        <div style={{ fontSize: "12px", color: "#666" }}>
          📅 {new Date(meeting.created_at).toLocaleString()}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px" }}>
        
        {/* LEFT: TRANSCRIPT */}
        <div style={{ backgroundColor: "white", padding: "25px", borderRadius: "12px", border: "1px solid #e5e5e5" }}>
          <h3 style={{ marginTop: 0, borderBottom: "1px solid #eee", paddingBottom: "10px" }}>📝 Transcript / Notes</h3>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.6", color: "#444", fontSize: "14px" }}>
            {meeting.transcript || "No transcript recorded."}
          </div>
        </div>

        {/* RIGHT: AI ANALYSIS */}
        <div>
          {analysis ? (
            <div style={{ backgroundColor: "#f0f9ff", padding: "20px", borderRadius: "12px", border: "1px solid #bae6fd" }}>
              <h3 style={{ marginTop: 0, color: "#0369a1" }}>🤖 AI Coach</h3>
              
              <div style={{ marginBottom: "15px" }}>
                <strong style={{ display: "block", fontSize: "12px", color: "#0369a1", marginBottom: "5px" }}>SUMMARY</strong>
                <p style={{ margin: 0, fontSize: "13px" }}>{analysis.summary}</p>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <strong style={{ display: "block", fontSize: "12px", color: "#0369a1", marginBottom: "5px" }}>SENTIMENT</strong>
                <div style={{ fontSize: "13px", fontWeight: "bold" }}>{analysis.sentiment}</div>
              </div>

              <div>
                <strong style={{ display: "block", fontSize: "12px", color: "#0369a1", marginBottom: "5px" }}>SUGGESTED NEXT STEPS</strong>
                <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
                  {analysis.next_steps?.map((step: string, i: number) => (
                    <li key={i}>{step}</li>
                  )) || <li>No specific steps detected.</li>}
                </ul>
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: "#f9fafb", padding: "20px", borderRadius: "12px", border: "1px solid #e5e5e5", textAlign: "center" }}>
              <div style={{ fontSize: "30px", marginBottom: "10px" }}>⏳</div>
              <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                <strong>Analysis Pending</strong><br/>
                The AI is still processing this meeting. Check back in a moment.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}