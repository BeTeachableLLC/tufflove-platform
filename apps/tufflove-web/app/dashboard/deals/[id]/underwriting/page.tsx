import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { saveUnderwritingInputsAction } from "@/app/actions";

export const dynamic = 'force-dynamic';

export default async function UnderwritingPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  const { id } = await params;

  // 1. Fetch Deal Context
  const { data: deal } = await supabase.from('deals').select('*').eq('id', id).single();
  if (!deal) return <div>Deal not found</div>;

  // 2. Fetch Financials & Assumptions (Single Record for v1)
  const { data: fin } = await supabase.from('deal_financials').select('*').eq('deal_id', id).single();
  const { data: asm } = await supabase.from('underwriting_assumptions').select('*').eq('deal_id', id).single();
  
  // 3. Fetch Results (Latest Calculation)
  const { data: results } = await supabase
    .from('underwriting_results')
    .select('*')
    .eq('deal_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return (
    <div style={{ padding: "40px", backgroundColor: "#F3F4F6", minHeight: "100vh", color: "#111827" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "100px", fontFamily: "sans-serif" }}>
        {/* HEADER */}
        <div style={{ marginBottom: "30px", borderBottom: "1px solid #E5E7EB", paddingBottom: "20px" }}>
          <Link href="/dashboard" style={{ fontSize: "12px", color: "#6B7280", textDecoration: "none" }}>← Back to Dashboard</Link>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
              <h1 style={{ margin: 0, fontSize: "24px", color: "#111827" }}>📊 Underwriting: {deal.deal_name}</h1>
              <span style={{ backgroundColor: "#E5E7EB", color: "#111827", padding: "5px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold" }}>
                  {deal.owner_mode === 'owner_operator' ? '👤 Owner-Operator' : '💼 Owner-Investor'}
              </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}>
        
        {/* LEFT COL: INPUTS */}
        <div>
            <form action={saveUnderwritingInputsAction.bind(null, id)}>
                
                {/* FINANCIALS */}
                <div style={{ marginBottom: "30px", backgroundColor: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #E5E7EB" }}>
                    <h3 style={{ marginTop: 0, borderBottom: "1px solid #E5E7EB", paddingBottom: "10px", color: "#111827" }}>1. Financials (TTM)</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                        <div>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "5px", color: "#6B7280" }}>Revenue</label>
                            <input name="revenue" type="number" step="0.01" defaultValue={fin?.revenue} style={{ width: "100%", padding: "8px", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "5px", color: "#6B7280" }}>SDE (Seller Discretionary)</label>
                            <input name="sde" type="number" step="0.01" defaultValue={fin?.sde} style={{ width: "100%", padding: "8px", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "5px", color: "#6B7280" }}>EBITDA (If provided)</label>
                            <input name="ebitda" type="number" step="0.01" defaultValue={fin?.ebitda} style={{ width: "100%", padding: "8px", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
                        </div>
                    </div>
                </div>

                {/* ASSUMPTIONS */}
                <div style={{ marginBottom: "30px", backgroundColor: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #E5E7EB" }}>
                    <h3 style={{ marginTop: 0, borderBottom: "1px solid #E5E7EB", paddingBottom: "10px", color: "#111827" }}>2. Adjustments & Debt</h3>
                    
                    <div style={{ marginBottom: "15px" }}>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "5px", color: "#b91c1c" }}>Operator Replacement Cost (Mandatory)</label>
                        <input name="operator_replacement_cost" type="number" step="0.01" defaultValue={asm?.operator_replacement_cost} placeholder="e.g. 100000" required style={{ width: "100%", padding: "8px", border: "1px solid #fca5a5", borderRadius: "6px" }} />
                        <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "3px" }}>Cost to hire a GM to run daily ops.</div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                         <div>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "5px", color: "#6B7280" }}>Rent Adjustments</label>
                            <input name="rent_adjustment" type="number" step="0.01" defaultValue={asm?.rent_adjustment} style={{ width: "100%", padding: "8px", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "5px", color: "#6B7280" }}>One-Time Expenses</label>
                            <input name="one_time_expense_adjustment" type="number" step="0.01" defaultValue={asm?.one_time_expense_adjustment} style={{ width: "100%", padding: "8px", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
                        </div>
                    </div>

                    <h4 style={{ fontSize: "14px", marginTop: "20px", marginBottom: "10px", color: "#111827" }}>Deal Structure</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                         <div style={{ gridColumn: "span 2" }}>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "5px", color: "#6B7280" }}>Purchase Price</label>
                            <input name="purchase_price" type="number" step="0.01" defaultValue={asm?.purchase_price} style={{ width: "100%", padding: "8px", border: "1px solid #D1D5DB", borderRadius: "6px", fontSize: "16px", fontWeight: "bold" }} />
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "5px", color: "#6B7280" }}>Down Payment % (Decimal)</label>
                            <input name="down_payment_percent" type="number" step="0.01" defaultValue={asm?.down_payment_percent || 0.10} style={{ width: "100%", padding: "8px", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "5px", color: "#6B7280" }}>Debt Interest Rate</label>
                            <input name="debt_interest_rate" type="number" step="0.001" defaultValue={asm?.debt_interest_rate || 0.10} style={{ width: "100%", padding: "8px", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
                        </div>
                    </div>
                </div>

                <button style={{ width: "100%", backgroundColor: "#111827", color: "#fff", padding: "15px", borderRadius: "8px", border: "none", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}>
                    🔄 Run Underwriting Model
                </button>
            </form>
        </div>

        {/* RIGHT COL: RESULTS */}
        <div>
            {results ? (
                <div style={{ position: "sticky", top: "20px" }}>
                    
                    {/* SCORECARD */}
                    <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "25px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                        <h2 style={{ marginTop: 0, fontSize: "18px", borderBottom: "2px solid #111827", paddingBottom: "10px", marginBottom: "20px", color: "#111827" }}>🏁 Deal Scorecard</h2>
                        
                        <div style={{ marginBottom: "25px" }}>
                            <div style={{ fontSize: "12px", textTransform: "uppercase", color: "#6B7280", fontWeight: "bold" }}>Normalized EBITDA</div>
                            <div style={{ fontSize: "32px", fontWeight: "900", color: "#111827" }}>
                                ${results.normalized_ebitda?.toLocaleString()}
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "25px" }}>
                            <div>
                                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#6B7280", fontWeight: "bold" }}>Annual Debt Service</div>
                                <div style={{ fontSize: "18px", fontWeight: "bold", color: "#111827" }}>${results.annual_debt_service?.toLocaleString()}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#6B7280", fontWeight: "bold" }}>DSCR</div>
                                <div style={{ fontSize: "24px", fontWeight: "bold", color: results.dscr >= 1.5 ? "#166534" : results.dscr >= 1.25 ? "#ca8a04" : "#dc2626" }}>
                                    {results.dscr?.toFixed(2)}x
                                </div>
                            </div>
                        </div>

                        {/* FLAGS */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {((results?.risk_flags || []) as Array<{ level?: string | null; message?: string | null }>).map((flag, idx) => (
                                <div key={idx} style={{ 
                                    padding: "10px", 
                                    borderRadius: "6px", 
                                    fontSize: "13px", 
                                    fontWeight: "500",
                                    backgroundColor: flag.level === 'red' ? '#fef2f2' : flag.level === 'yellow' ? '#fefce8' : '#f0fdf4',
                                    color: flag.level === 'red' ? '#991b1b' : flag.level === 'yellow' ? '#854d0e' : '#166534',
                                    border: `1px solid ${flag.level === 'red' ? '#fecaca' : flag.level === 'yellow' ? '#fde047' : '#bbf7d0'}`
                                }}>
                                    {flag.level === 'red' ? '⛔' : flag.level === 'yellow' ? '⚠️' : '✅'} {flag.message}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CALCULATION TRACE */}
                    <div style={{ marginTop: "20px", padding: "20px", backgroundColor: "#F9FAFB", borderRadius: "12px", fontSize: "12px", color: "#6B7280", border: "1px solid #E5E7EB" }}>
                        <h4 style={{ margin: "0 0 10px 0", textTransform: "uppercase", color: "#111827" }}>Calculation Trace (Audit)</h4>
                        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                            {JSON.stringify(results.calculation_trace, null, 2)}
                        </pre>
                    </div>

                </div>
            ) : (
                <div style={{ textAlign: "center", padding: "50px", color: "#6B7280", border: "2px dashed #E5E7EB", borderRadius: "12px", backgroundColor: "#fff" }}>
                    Enter financials and run the model to see results.
                </div>
            )}
        </div>

        </div>
      </div>
    </div>
  );
}
