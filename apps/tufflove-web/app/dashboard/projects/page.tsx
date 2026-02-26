import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

type Project = {
  id: string;
  status: string;
  title: string;
  priority?: string | null;
  client_name?: string | null;
  deadline?: string | null;
};

export default async function ProjectsBoard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  const { data: projects } = await supabase.from('projects').select('*').order('deadline', { ascending: true });

  // UPDATED: Added "Paused" and "Lost" to the columns list
  const columns = ["Planning", "In Progress", "Review", "Done", "Paused", "Lost"];

  const projectList = (projects || []) as Project[];
  // Function to filter projects by status
  const getProjects = (status: string) => projectList.filter((p) => p.status === status);

  return (
    <div style={{ fontFamily: "sans-serif", color: "#333", height: "calc(100vh - 100px)" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: "0 0 5px 0", color: "black" }}>🚀 Project Command Center</h1>
          <p style={{ margin: 0, color: "#666" }}>Manage delivery, track deadlines, and execute.</p>
        </div>
        <Link href="/dashboard/projects/new" style={{ textDecoration: "none" }}>
          <button style={{ backgroundColor: "black", color: "white", padding: "10px 20px", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
            + New Project
          </button>
        </Link>
      </div>

      {/* KANBAN GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 300px)", gap: "20px", height: "100%", overflowX: "auto", paddingBottom: "20px" }}>
        
        {columns.map((col) => (
          <div key={col} style={{ backgroundColor: "#f3f4f6", borderRadius: "12px", padding: "15px", display: "flex", flexDirection: "column", minWidth: "280px" }}>
            
            {/* Column Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", paddingBottom: "10px", borderBottom: "1px solid #e5e5e5" }}>
              <span style={{ fontWeight: "bold", color: "#4b5563" }}>{col}</span>
              <span style={{ fontSize: "12px", background: "#e5e7eb", padding: "2px 8px", borderRadius: "10px" }}>
                {getProjects(col).length}
              </span>
            </div>

            {/* Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
              {getProjects(col).map((project) => (
                <div key={project.id} style={{ backgroundColor: "white", padding: "15px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", borderLeft: `4px solid ${project.priority === 'High' ? '#ef4444' : project.priority === 'Medium' ? '#f59e0b' : '#10b981'}` }}>
                  
                  {/* UPDATED: Title is now a Link to the Detail Page */}
                  <Link href={`/dashboard/projects/${project.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "5px", cursor: "pointer" }}>
                       {project.title} <span style={{ fontSize: "10px", color: "blue" }}>↗</span>
                    </div>
                  </Link>
                  
                  {project.client_name && (
                    <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>👤 {project.client_name}</div>
                  )}
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                    <div style={{ fontSize: "11px", color: project.deadline ? "#dc2626" : "#999", fontWeight: "bold" }}>
                      {project.deadline ? `📅 ${new Date(project.deadline).toLocaleDateString()}` : "No Date"}
                    </div>
                  </div>

                </div>
              ))}
              {getProjects(col).length === 0 && (
                <div style={{ textAlign: "center", padding: "20px", color: "#9ca3af", fontSize: "12px", border: "1px dashed #d1d5db", borderRadius: "6px" }}>
                  Empty
                </div>
              )}
            </div>

          </div>
        ))}

      </div>
    </div>
  );
}
