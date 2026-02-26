import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  // Get the project ID from the URL
  const { id } = await params;

  // Fetch the project data
  const { data: project } = await supabase.from('projects').select('*').eq('id', id).single();

  if (!project) return <div>Project not found</div>;

  // --- ACTIONS ---

  async function updateStatus(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const newStatus = formData.get("status");
    await supabase.from("projects").update({ status: newStatus }).eq("id", id);
    redirect("/dashboard/projects");
  }

  async function deleteProject() {
    "use server";
    const supabase = await createClient();
    
    // First unlink meetings (safety check)
    await supabase.from("meetings").update({ project_id: null }).eq("project_id", id);
    
    // Then delete the project
    await supabase.from("projects").delete().eq("id", id);
    redirect("/dashboard/projects");
  }

  // Helper styles
  const cardStyle = { backgroundColor: "white", padding: "30px", borderRadius: "12px", border: "1px solid #e5e5e5", marginBottom: "20px" };
  const labelStyle = { fontSize: "12px", fontWeight: "bold", color: "#666", textTransform: "uppercase" as const, marginBottom: "5px" };
  const valueStyle = { fontSize: "18px", fontWeight: "500", color: "#111", marginBottom: "20px" };

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto", paddingBottom: "50px", color: "#333" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <Link href="/dashboard/projects" style={{ color: "gray", textDecoration: "none", fontSize: "14px" }}>← Back to Board</Link>
        <form action={deleteProject}>
            <button style={{ backgroundColor: "white", color: "#dc2626", border: "1px solid #dc2626", padding: "8px 15px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>
                🗑️ Delete Project
            </button>
        </form>
      </div>

      <h1 style={{ fontSize: "32px", margin: "0 0 10px 0", color: "black" }}>{project.title}</h1>
      <div style={{ display: "inline-block", padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", backgroundColor: "#f3f4f6", color: "#333", marginBottom: "30px" }}>
        Current Stage: {project.status}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px" }}>
        
        {/* LEFT COLUMN: DETAILS */}
        <div>
           <div style={cardStyle}>
              <div style={labelStyle}>Client Name</div>
              <div style={valueStyle}>{project.client_name || "N/A"}</div>

              <div style={labelStyle}>Deadline</div>
              <div style={valueStyle}>{project.deadline ? new Date(project.deadline).toLocaleDateString() : "No Deadline"}</div>

              <div style={labelStyle}>Priority</div>
              <div style={{ ...valueStyle, color: project.priority === 'High' ? '#dc2626' : '#111' }}>
                 {project.priority || "Medium"}
              </div>
           </div>
        </div>

        {/* RIGHT COLUMN: ACTIONS */}
        <div>
           <div style={{ ...cardStyle, backgroundColor: "#f9fafb" }}>
              <h3 style={{ marginTop: 0, fontSize: "16px", borderBottom: "1px solid #ddd", paddingBottom: "10px" }}>Disposition</h3>
              
              <form action={updateStatus} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                 <button name="status" value="Planning" style={{ padding: "10px", border: "1px solid #ddd", background: "white", borderRadius: "6px", cursor: "pointer", textAlign: "left" }}>📋 Move to Planning</button>
                 <button name="status" value="In Progress" style={{ padding: "10px", border: "1px solid #ddd", background: "white", borderRadius: "6px", cursor: "pointer", textAlign: "left" }}>🏗️ Mark In Progress</button>
                 <button name="status" value="Review" style={{ padding: "10px", border: "1px solid #ddd", background: "white", borderRadius: "6px", cursor: "pointer", textAlign: "left" }}>👀 Needs Review</button>
                 <button name="status" value="Done" style={{ padding: "10px", border: "1px solid #ddd", background: "#f0fdf4", color: "green", borderRadius: "6px", cursor: "pointer", textAlign: "left", fontWeight: "bold" }}>✅ Mark Complete</button>
                 <div style={{ height: "1px", background: "#ddd", margin: "10px 0" }}></div>
                 <button name="status" value="Paused" style={{ padding: "10px", border: "1px solid #ddd", background: "#fffbeb", color: "#b45309", borderRadius: "6px", cursor: "pointer", textAlign: "left" }}>⏸️ Pause Project</button>
                 <button name="status" value="Lost" style={{ padding: "10px", border: "1px solid #ddd", background: "#fef2f2", color: "#991b1b", borderRadius: "6px", cursor: "pointer", textAlign: "left" }}>❌ Closed Lost</button>
              </form>
           </div>
        </div>

      </div>
    </div>
  );
}