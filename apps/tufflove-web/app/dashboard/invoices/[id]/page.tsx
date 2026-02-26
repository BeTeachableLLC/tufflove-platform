import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  addInvoiceItemAction, 
  deleteInvoiceItemAction, 
  updateInvoiceStatusAction, 
  sendInvoiceEmailAction 
} from "@/app/actions";
import InvoicePrintButton from "@/app/components/InvoicePrintButton";

// Ensure fresh data always
export const dynamic = 'force-dynamic';

export default async function InvoiceEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  const { id } = await params;

  // Fetch Invoice
  const { data: invoice } = await supabase.from('invoices').select('*, companies(*)').eq('id', id).single();
  // Fetch Items
  const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', id).order('created_at', { ascending: true });

  if (!invoice) return <div>Invoice not found</div>;

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  const formatDate = (dateString: string) => dateString ? new Date(dateString).toLocaleDateString() : "N/A";
  const isCancelled = invoice.status === "Cancelled";

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto", paddingBottom: "100px", color: "#333" }}>
      
      {/* HEADER CONTROLS */}
      <div className="no-print" style={{ marginBottom: "20px", padding: "20px", background: "#f9fafb", borderRadius: "12px", border: "1px solid #e5e5e5" }}>
        
        {/* ROW 1: Navigation & Status */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <Link href="/dashboard/invoices" style={{ color: "gray", textDecoration: "none", fontSize: "14px" }}>← Back to Invoices</Link>
            <div style={{ display: "flex", gap: "10px" }}>
                 <form action={updateInvoiceStatusAction.bind(null, id, "Draft")}>
                    <button disabled={isCancelled} style={{ padding: "8px 12px", border: "1px solid #ccc", background: "white", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>Draft</button>
                 </form>
                 <form action={updateInvoiceStatusAction.bind(null, id, "Paid")}>
                    <button style={{ padding: "8px 12px", border: "1px solid #16a34a", background: "#dcfce7", color: "#166534", fontWeight: "bold", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Mark Paid</button>
                </form>
                {!isCancelled && (
                  <form action={updateInvoiceStatusAction.bind(null, id, "Cancelled")}>
                      <button style={{ padding: "8px 12px", border: "1px solid #dc2626", background: "#fee2e2", color: "#991b1b", fontWeight: "bold", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Cancel</button>
                  </form>
                )}
            </div>
        </div>

        {/* ROW 2: Email Sender */}
        {!isCancelled && (
            <div style={{ display: "flex", gap: "10px", alignItems: "center", borderTop: "1px solid #e5e5e5", paddingTop: "15px" }}>
                <form action={async (formData) => {
                    "use server";
                    await sendInvoiceEmailAction(id, formData.get("email") as string);
                }} style={{ display: "flex", gap: "10px", flex: 1 }}>
                    <input 
                        name="email" 
                        type="email" 
                        defaultValue={invoice.client_email || ""} 
                        placeholder="Client Email (e.g. client@gmail.com)" 
                        required 
                        style={{ flex: 1, padding: "10px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "14px" }} 
                    />
                    <button style={{ backgroundColor: "black", color: "white", padding: "10px 20px", borderRadius: "4px", border: "none", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>
                        📧 Send
                    </button>
                </form>
                <div style={{ fontSize: "12px", color: "#666" }}>
                    Public Link: <a href={`/portal/${id}`} target="_blank" style={{color: "blue"}}>Open</a>
                </div>
            </div>
        )}
      </div>

      {isCancelled && (
        <div className="no-print" style={{ backgroundColor: "#fef2f2", color: "#991b1b", padding: "15px", borderRadius: "8px", border: "1px solid #fecaca", marginBottom: "20px", textAlign: "center" }}>
            This invoice is <b>Cancelled</b>. Click &quot;Draft&quot; above to reopen it.
        </div>
      )}

      {/* INVOICE SHEET */}
      <div className="invoice-sheet" style={{ backgroundColor: "white", padding: "40px", border: "1px solid #e5e5e5", minHeight: "600px" }}>
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

        {/* ITEMS LIST */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px" }}>
            <thead>
                <tr style={{ borderBottom: "1px solid #eee", color: "#666", fontSize: "12px", textTransform: "uppercase" }}>
                    <th style={{ textAlign: "left", padding: "10px 0" }}>Description</th>
                    <th style={{ textAlign: "center", padding: "10px 0", width: "60px" }}>Qty</th>
                    <th style={{ textAlign: "right", padding: "10px 0", width: "100px" }}>Price</th>
                    <th style={{ textAlign: "right", padding: "10px 0", width: "100px" }}>Amount</th>
                    <th className="no-print" style={{ width: "30px" }}></th>
                </tr>
            </thead>
            <tbody>
                {items?.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "15px 0", fontWeight: "500" }}>{item.description}</td>
                        <td style={{ padding: "15px 0", textAlign: "center" }}>{item.quantity}</td>
                        <td style={{ padding: "15px 0", textAlign: "right" }}>${item.unit_price}</td>
                        <td style={{ padding: "15px 0", textAlign: "right", fontWeight: "bold" }}>{formatMoney(item.amount)}</td>
                        <td className="no-print" style={{ textAlign: "right" }}>
                            <form action={deleteInvoiceItemAction.bind(null, item.id, id)}>
                                <button style={{ border: "none", background: "none", color: "red", cursor: "pointer", fontWeight: "bold" }}>×</button>
                            </form>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>

        {/* ADD ITEM INPUT ROW */}
        {!isCancelled && (
            <div className="no-print" style={{ backgroundColor: "#f9fafb", padding: "15px", borderRadius: "8px", marginBottom: "40px" }}>
                <form action={addInvoiceItemAction.bind(null, id)} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <input name="description" placeholder="Item Description..." required style={{ flex: 1, padding: "10px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "14px" }} />
                    <input name="quantity" type="number" defaultValue="1" step="0.01" required style={{ width: "60px", padding: "10px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "14px" }} />
                    <input name="unit_price" type="number" placeholder="0.00" step="0.01" required style={{ width: "80px", padding: "10px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "14px" }} />
                    <button style={{ background: "black", color: "white", border: "none", borderRadius: "4px", padding: "10px 15px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>Add Item</button>
                </form>
            </div>
        )}

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
