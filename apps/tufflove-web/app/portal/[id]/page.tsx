import { createClient } from "@/utils/supabase/server";
import InvoicePrintButton from "@/app/components/InvoicePrintButton";

// Allow public access (No user check)
export default async function PublicInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  // Fetch Invoice (Public Read)
  const { data: invoice } = await supabase.from('invoices').select('*, companies(*)').eq('id', id).single();
  const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', id).order('created_at', { ascending: true });

  if (!invoice) return <div style={{ padding: "50px", textAlign: "center" }}>Invoice not found or expired.</div>;

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  const formatDate = (dateString: string) => dateString ? new Date(dateString).toLocaleDateString() : "N/A";

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto", padding: "50px 20px", color: "#333" }}>
      
      {/* SECURITY BANNER */}
      <div className="no-print" style={{ textAlign: "center", marginBottom: "30px", fontSize: "12px", color: "#666" }}>
        🔒 Secure Client Portal provided by {invoice.companies?.name}
      </div>

      {/* INVOICE SHEET */}
      <div className="invoice-sheet" style={{ backgroundColor: "white", padding: "40px", border: "1px solid #e5e5e5", minHeight: "600px", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
        
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "40px", borderBottom: "2px solid #000", paddingBottom: "20px" }}>
            <div>
                <h1 style={{ margin: 0, fontSize: "24px" }}>{invoice.companies?.name}</h1>
                <div style={{ color: "#666", fontSize: "14px", marginTop: "5px" }}>INVOICE #{invoice.id.slice(0, 8).toUpperCase()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Bill To</div>
                <div style={{ fontWeight: "bold", fontSize: "16px" }}>{invoice.client_name}</div>
                <div style={{ fontSize: "14px", marginTop: "5px" }}>Due: {formatDate(invoice.due_date)}</div>
            </div>
        </div>

        {/* ITEMS */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px" }}>
            <thead>
                <tr style={{ borderBottom: "1px solid #eee", color: "#666", fontSize: "12px", textTransform: "uppercase" }}>
                    <th style={{ textAlign: "left", padding: "10px 0" }}>Description</th>
                    <th style={{ textAlign: "center", padding: "10px 0", width: "60px" }}>Qty</th>
                    <th style={{ textAlign: "right", padding: "10px 0", width: "100px" }}>Price</th>
                    <th style={{ textAlign: "right", padding: "10px 0", width: "100px" }}>Amount</th>
                </tr>
            </thead>
            <tbody>
                {items?.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "15px 0", fontWeight: "500" }}>{item.description}</td>
                        <td style={{ padding: "15px 0", textAlign: "center" }}>{item.quantity}</td>
                        <td style={{ padding: "15px 0", textAlign: "right" }}>${item.unit_price}</td>
                        <td style={{ padding: "15px 0", textAlign: "right", fontWeight: "bold" }}>{formatMoney(item.amount)}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        {/* TOTAL */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ textAlign: "right", width: "200px" }}>
                <div style={{ borderTop: "2px solid #000", paddingTop: "10px", marginTop: "10px", fontSize: "14px", fontWeight: "bold", display: "flex", justifyContent: "space-between" }}>
                    <span>TOTAL</span>
                    <span style={{ fontSize: "20px" }}>{formatMoney(invoice.total_amount)}</span>
                </div>
            </div>
        </div>
      </div>

      <InvoicePrintButton />
    </div>
  );
}
