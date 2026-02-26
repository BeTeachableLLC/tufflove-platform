import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NewProjectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  async function createProject(formData: FormData) {
    "use server";
    const supabase = await createClient();
    
    // Extract data from the form
    const title = formData.get("title") as string;
    const client_name = formData.get("client_name") as string;
    const deadline = formData.get("deadline") as string;
    const priority = formData.get("priority") as string;
    
    // Insert into Supabase
    const { error } = await supabase.from("projects").insert({ 
      title, 
      client_name, 
      deadline: deadline || null,
      priority,
      status: "Planning" // Default status
    });

    if (error) console.error(error);
    
    redirect("/dashboard/projects");
  }

  // Styles for the inputs
  const inputStyle = { 
    width: "100%", 
    padding: "10px", 
    borderRadius: "6px", 
    border: "1px solid #ccc", 
    marginBottom: "15px", 
    color: "black", 
    backgroundColor: "white",
    fontSize: "14px"
  };

  const labelStyle = {
    display: "block",
    fontSize: "12px",
    fontWeight: "bold",
    marginBottom: "5px",
    color: "#333"
  };

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto", color: "#333" }}>
      <Link href="/dashboard/projects" style={{ color: "gray", textDecoration: "none", fontSize: "12px" }}>← Back to Board</Link>
      <h1 style={{ marginTop: "10px", marginBottom: "20px", color: "black" }}>🏗️ Create New Project</h1>
      
      <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", border: "1px solid #e5e5e5" }}>
        <form action={createProject}>
          
          {/* TITLE INPUT */}
          <div>
            <label style={labelStyle}>Project Title</label>
            <input name="title" required placeholder="e.g. Downtown Office Renovation" style={inputStyle} />
          </div>

          {/* CLIENT INPUT */}
          <div>
            <label style={labelStyle}>Client Name</label>
            <input name="client_name" placeholder="e.g. Acme Corp" style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            
            {/* DEADLINE INPUT */}
            <div>
              <label style={labelStyle}>Deadline</label>
              <input type="date" name="deadline" style={inputStyle} />
            </div>
            
            {/* PRIORITY DROPDOWN */}
            <div>
              <label style={labelStyle}>Priority</label>
              <select name="priority" style={inputStyle}>
                <option value="Medium">Medium</option>
                <option value="High">High 🔥</option>
                <option value="Low">Low</option>
              </select>
            </div>

          </div>

          <button style={{ width: "100%", padding: "12px", background: "black", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", marginTop: "10px" }}>
            Launch Project
          </button>

        </form>
      </div>
    </div>
  );
}