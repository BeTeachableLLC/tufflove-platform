import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function DealsIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  // Fetch deals joined with their latest results if possible, 
  // but for V1 we just fetch the deal list to keep it fast.
  const { data: deals } = await supabase.from('deals').select('*').order('updated_at', { ascending: false });

  return (
    <div style={{ padding: "40px", backgroundColor: "#F3F4F6", minHeight: "100vh", color: "#111827" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "28px", margin: 0 }}>💼 Active Deals</h1>
            <p style={{ margin: "6px 0 0", color: "#6B7280", fontSize: "14px" }}>Track open opportunities and next steps.</p>
          </div>
          <Link href="/dashboard/tactix" style={{ backgroundColor: "#111827", color: "#fff", padding: "10px 18px", borderRadius: "8px", textDecoration: "none", fontWeight: "600" }}>
            + New Deal from Leads
          </Link>
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          {deals?.map(deal => (
            <Link key={deal.id} href={`/dashboard/deals/${deal.id}/underwriting`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ backgroundColor: "#fff", padding: "18px 20px", borderRadius: "12px", border: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "6px", color: "#111827" }}>{deal.deal_name}</div>
                  <div style={{ fontSize: "12px", color: "#6B7280", display: "flex", gap: "10px", alignItems: "center" }}>
                    <span style={{ textTransform: "uppercase", fontWeight: 700, color: "#111827" }}>{deal.stage}</span>
                    <span>Owner: {deal.owner_mode === 'owner_operator' ? 'Operator' : 'Investor'}</span>
                  </div>
                </div>
                <div style={{ fontSize: "14px", color: "#2563eb", fontWeight: 600 }}>
                  View Underwriting →
                </div>
              </div>
            </Link>
          ))}

          {(!deals || deals.length === 0) && (
            <div style={{ padding: "36px", textAlign: "center", color: "#6B7280", backgroundColor: "#F9FAFB", borderRadius: "12px", border: "1px dashed #E5E7EB" }}>
              No active deals. Go to <Link href="/dashboard/tactix">TactiX</Link> to promote a lead.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
