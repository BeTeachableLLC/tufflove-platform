import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  // Fetch invoices with company names
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, companies(name)')
    .order('created_at', { ascending: false });

  // Helper to format currency
  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "1000px", margin: "0 auto", paddingBottom: "100px", color: "#333" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div>
           <h1 style={{ color: "black", margin: "0 0 5px 0" }}>💰 Invoices & Revenue</h1>
           <p style={{ color: "#666", margin: 0 }}>Track billing across all your companies.</p>
        </div>
        <Link href="/dashboard/invoices/new">
          <button style={{ backgroundColor: "black", color: "white", padding: "10px 20px", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
            + New Invoice
          </button>
        </Link>
      </div>

      {/* STATS ROW (Simple Calculation) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "40px" }}>
        <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e5e5e5" }}>
            <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", fontWeight: "bold" }}>Total Revenue (Paid)</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#16a34a" }}>
                {formatMoney(invoices?.filter(i => i.status === 'Paid').reduce((acc, curr) => acc + (curr.total_amount || 0), 0) || 0)}
            </div>
        </div>
        <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e5e5e5" }}>
            <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", fontWeight: "bold" }}>Outstanding (Unpaid)</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#ea580c" }}>
                {formatMoney(invoices?.filter(i => i.status !== 'Paid' && i.status !== 'Draft').reduce((acc, curr) => acc + (curr.total_amount || 0), 0) || 0)}
            </div>
        </div>
        <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e5e5e5" }}>
            <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", fontWeight: "bold" }}>Drafts</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#666" }}>
                {invoices?.filter(i => i.status === 'Draft').length || 0}
            </div>
        </div>
      </div>

      {/* INVOICE LIST */}
      <div style={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e5e5e5", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e5e5" }}>
            <tr>
              <th style={{ textAlign: "left", padding: "15px", fontSize: "12px", color: "#666" }}>STATUS</th>
              <th style={{ textAlign: "left", padding: "15px", fontSize: "12px", color: "#666" }}>CLIENT</th>
              <th style={{ textAlign: "left", padding: "15px", fontSize: "12px", color: "#666" }}>COMPANY</th>
              <th style={{ textAlign: "left", padding: "15px", fontSize: "12px", color: "#666" }}>DATE</th>
              <th style={{ textAlign: "right", padding: "15px", fontSize: "12px", color: "#666" }}>AMOUNT</th>
              <th style={{ textAlign: "right", padding: "15px", fontSize: "12px", color: "#666" }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {invoices?.map((inv) => (
              <tr key={inv.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "15px" }}>
                  <span style={{ 
                    padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "bold",
                    backgroundColor: inv.status === 'Paid' ? '#dcfce7' : inv.status === 'Sent' ? '#dbeafe' : '#f3f4f6',
                    color: inv.status === 'Paid' ? '#166534' : inv.status === 'Sent' ? '#1e40af' : '#4b5563'
                  }}>
                    {inv.status}
                  </span>
                </td>
                <td style={{ padding: "15px", fontWeight: "500" }}>{inv.client_name}</td>
                <td style={{ padding: "15px", color: "#666", fontSize: "13px" }}>{inv.companies?.name}</td>
                <td style={{ padding: "15px", color: "#666", fontSize: "13px" }}>{new Date(inv.issue_date).toLocaleDateString()}</td>
                <td style={{ padding: "15px", textAlign: "right", fontWeight: "bold" }}>{formatMoney(inv.total_amount)}</td>
                <td style={{ padding: "15px", textAlign: "right" }}>
                   <Link href={`/dashboard/invoices/${inv.id}`} style={{ fontSize: "12px", color: "black", textDecoration: "underline" }}>Open</Link>
                </td>
              </tr>
            ))}
            {(!invoices || invoices.length === 0) && (
                <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#999" }}>No invoices found. Create your first one!</td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
