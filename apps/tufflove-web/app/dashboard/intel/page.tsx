import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

type LeadRow = {
  id: string;
  name?: string | null;
  company?: string | null;
  status?: string | null;
  email?: string | null;
};

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  const { data: leads } = await supabase.from('leads').select('*').order('created_at', { ascending: false });

  return (
    // ADDED color: "#111" to force dark text
    <div style={{ fontFamily: "sans-serif", color: "#111" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <h1 style={{ margin: 0, color: "black" }}>💰 Sales Pipeline</h1>
        <Link href="/dashboard/intel/new" style={{ textDecoration: "none" }}>
          <button style={{ backgroundColor: "black", color: "white", padding: "10px 20px", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
            + New Prospect
          </button>
        </Link>
      </div>

      <div style={{ backgroundColor: "white", borderRadius: "8px", border: "1px solid #e5e5e5", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e5e5" }}>
              <th style={{ padding: "15px", textAlign: "left", fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Prospect Name</th>
              <th style={{ padding: "15px", textAlign: "left", fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Company</th>
              <th style={{ padding: "15px", textAlign: "left", fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Status</th>
              <th style={{ padding: "15px", textAlign: "right", fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Contact</th>
            </tr>
          </thead>
          <tbody>
            {((leads || []) as LeadRow[]).map((lead) => (
              <tr key={lead.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "15px", color: "#333", fontWeight: "500" }}>{lead.name}</td>
                <td style={{ padding: "15px", color: "#666" }}>{lead.company || "-"}</td>
                <td style={{ padding: "15px" }}>
                  <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold", backgroundColor: lead.status === 'New' ? '#dbeafe' : '#fef3c7', color: lead.status === 'New' ? '#1e40af' : '#92400e' }}>
                    {lead.status}
                  </span>
                </td>
                <td style={{ padding: "15px", textAlign: "right", color: "#333", fontSize: "12px" }}>{lead.email || "No Email"}</td>
              </tr>
            ))}
            {(!leads || leads.length === 0) && (
              <tr>
                <td colSpan={4} style={{ padding: "40px", textAlign: "center", color: "gray" }}>
                   No leads yet. Click the black &quot;+ New Prospect&quot; button above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
