import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AddLeadButton from "./AddLeadButton";

export const dynamic = 'force-dynamic';

export default async function PitchGeniusPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  const { data: leads } = await supabase.from('leads').select('*').order('created_at', { ascending: false });

  return (
    <div style={{ backgroundColor: "#F3F4F6", minHeight: "100vh", color: "#111827" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 20px", fontFamily: "sans-serif" }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", borderBottom: "1px solid #e5e7eb", paddingBottom: "20px" }}>
        <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", margin: 0, color: "#000" }}>TacTix by TUFF LOVE</h1>
            <p style={{ color: "#4b5563", margin: "5px 0 0 0" }}>Origination & Outreach Engine by BeTeachable</p>
        </div>
        
        <AddLeadButton />
      </div>

      {/* LEAD LIST */}
      <div style={{ display: "grid", gap: "16px" }}>
        {leads?.map(lead => (
             <Link key={lead.id} href={`/dashboard/leads/${lead.id}`} style={{ textDecoration: "none" }}>
                <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", transition: "transform 0.1s" }}>
                    <div>
                        <div style={{ fontSize: "18px", fontWeight: "700", marginBottom: "6px", color: "#111827" }}>
                            {lead.company_name || lead.company || "New Prospect"}
                        </div>
                        <div style={{ fontSize: "13px", color: "#6b7280", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <span style={{ 
                                backgroundColor: lead.status === 'New' ? '#dbeafe' : '#f3f4f6', 
                                color: lead.status === 'New' ? '#1e40af' : '#374151',
                                padding: "4px 8px", borderRadius: "4px", fontWeight: "600", fontSize: "11px", textTransform: "uppercase" 
                            }}>
                                {lead.status || "New"}
                            </span>
                            {lead.pipeline_stage ? (
                              <span style={{ padding: "4px 8px", borderRadius: "4px", backgroundColor: "#ecfeff", color: "#0f766e", fontWeight: "600", fontSize: "11px", textTransform: "uppercase" }}>
                                {lead.pipeline_stage}
                              </span>
                            ) : null}
                            {lead.campaign ? (
                              <span style={{ padding: "4px 8px", borderRadius: "4px", backgroundColor: "#fef9c3", color: "#92400e", fontWeight: "600", fontSize: "11px", textTransform: "uppercase" }}>
                                {lead.campaign}
                              </span>
                            ) : null}
                            <span>•</span>
                            <span>{lead.contact_name || lead.name || "No Contact"}</span>
                        </div>
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#2563eb", display: "flex", alignItems: "center" }}>
                        Manage Prospect →
                    </div>
                </div>
             </Link>
        ))}

        {(!leads || leads.length === 0) && (
            <div style={{ padding: "60px", textAlign: "center", color: "#6b7280", backgroundColor: "#f9fafb", borderRadius: "12px", border: "2px dashed #e5e7eb" }}>
                <div style={{ fontSize: "40px", marginBottom: "10px" }}>📭</div>
                <h3 style={{ margin: "0 0 10px 0", color: "#111" }}>No leads found</h3>
                <p>Click the black button above to add your first lead.</p>
            </div>
        )}
      </div>
      </div>
    </div>
  );
}
