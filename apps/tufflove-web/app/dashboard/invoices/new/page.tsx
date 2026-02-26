import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NewInvoicePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  // Fetch companies for the dropdown
  const { data: companies } = await supabase.from('companies').select('*');

  async function createInvoice(formData: FormData) {
    "use server";
    const supabase = await createClient();
    
    const client_name = formData.get("client_name");
    const company_id = formData.get("company_id");
    const issue_date = formData.get("issue_date");
    const due_date = formData.get("due_date");

    // Create the blank invoice wrapper
    const { data, error } = await supabase.from('invoices').insert({
        client_name,
        company_id,
        issue_date,
        due_date: due_date || null,
        status: "Draft",
        total_amount: 0 // Will update when items are added
    }).select().single();

    if (error) console.error(error);
    
    // Redirect to the "Edit Mode" where we add items
    if (data) redirect(`/dashboard/invoices/${data.id}`);
  }

  const inputStyle = { width: "100%", padding: "12px", borderRadius: "6px", border: "1px solid #ccc", marginBottom: "20px", color: "black", backgroundColor: "white" };
  const labelStyle = { display: "block", fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "5px" };

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto", paddingBottom: "50px" }}>
      <Link href="/dashboard/invoices" style={{ color: "gray", textDecoration: "none", fontSize: "12px" }}>← Cancel</Link>
      <h1 style={{ marginTop: "10px", color: "black" }}>📄 New Invoice</h1>
      
      <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", border: "1px solid #e5e5e5" }}>
        <form action={createInvoice}>
            
            <label style={labelStyle}>Billing Company (You)</label>
            <select name="company_id" style={inputStyle} required>
                {companies?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <label style={labelStyle}>Client Name (Bill To)</label>
            <input name="client_name" placeholder="e.g. Acme Corp" required style={inputStyle} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                    <label style={labelStyle}>Issue Date</label>
                    <input type="date" name="issue_date" defaultValue={new Date().toISOString().split('T')[0]} style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>Due Date</label>
                    <input type="date" name="due_date" style={inputStyle} />
                </div>
            </div>

            <button style={{ width: "100%", padding: "15px", background: "black", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
                Create & Add Items →
            </button>
        </form>
      </div>
    </div>
  );
}