import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function PlanningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return redirect("/join");

  // Fetch goals
  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .order('created_at', { ascending: false });

  // Action: Create a new Goal
  async function createGoal(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("goals").insert({
      title: formData.get("title") as string,
      target_amount: Number(formData.get("target_amount")),
      current_amount: Number(formData.get("current_amount")),
      quarter: "Q1", // Default to Q1 for now
      year: 2026,
      user_id: user.id,
    });
    revalidatePath("/dashboard/planning");
  }

  // Action: Update Progress (Quick Add)
  // Real apps would link this to invoices, but manual entry is faster for now.
  
  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ borderBottom: "4px solid black", paddingBottom: "10px", marginBottom: "30px" }}>
        🎯 Strategic Planning (2026)
      </h1>

      {/* 1. New Goal Form */}
      <div style={{ backgroundColor: "#f4f4f5", padding: "20px", borderRadius: "8px", marginBottom: "40px" }}>
        <h3 style={{ marginTop: 0, color: "black" }}>Set New Target</h3>
        <form action={createGoal} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "10px", alignItems: "end" }}>
          
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "5px" }}>Goal Name</label>
            <input name="title" placeholder="e.g. Q1 Revenue" required style={{ width: "100%", padding: "10px", border: "1px solid #ccc", color: "black" }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "5px" }}>Target ($)</label>
            <input name="target_amount" type="number" placeholder="50000" required style={{ width: "100%", padding: "10px", border: "1px solid #ccc", color: "black" }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "5px" }}>Current ($)</label>
            <input name="current_amount" type="number" placeholder="0" required style={{ width: "100%", padding: "10px", border: "1px solid #ccc", color: "black" }} />
          </div>

          <button type="submit" style={{ padding: "10px 20px", background: "black", color: "white", border: "none", cursor: "pointer", height: "40px" }}>
            Add
          </button>
        </form>
      </div>

      {/* 2. Goals List with Progress Bars */}
      <div style={{ display: "grid", gap: "20px" }}>
        {goals?.map((goal) => {
          const progress = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
          
          return (
            <div key={goal.id} style={{ border: "1px solid #e5e5e5", borderRadius: "8px", padding: "25px", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "20px" }}>{goal.title}</h2>
                  <span style={{ fontSize: "14px", color: "gray", fontWeight: "bold" }}>{goal.quarter} {goal.year}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "24px", fontWeight: "bold" }}>{progress}%</div>
                  <div style={{ fontSize: "14px", color: "gray" }}>
                    ${goal.current_amount.toLocaleString()} / ${goal.target_amount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* The Progress Bar */}
              <div style={{ width: "100%", height: "12px", backgroundColor: "#e5e5e5", borderRadius: "6px", overflow: "hidden" }}>
                <div style={{ 
                  width: `${progress}%`, 
                  height: "100%", 
                  backgroundColor: progress >= 100 ? "#10b981" : "black", // Green if done, Black if pending
                  transition: "width 0.5s ease" 
                }} />
              </div>
            </div>
          );
        })}
        
        {(!goals || goals.length === 0) && (
          <p style={{ textAlign: "center", color: "gray", marginTop: "20px" }}>No active goals. Set a target above to start tracking.</p>
        )}
      </div>
    </div>
  );
}