import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

type Assignment = {
  id?: string | null;
  company_id?: string | null;
  companies?: { name?: string | null } | null;
};

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  const { id } = await params;

  // Fetch Member Details
  const { data: member } = await supabase.from('team_members').select('*').eq('id', id).single();
  
  // Fetch Assigned Companies (prefer company_members by user_id, fallback to legacy company_assignments)
  let assignments: Assignment[] = [];
  if (member?.user_id) {
    const { data: memberCompanies } = await supabase
      .from("company_members")
      .select("role, companies(name)")
      .eq("user_id", member.user_id);
    assignments = (memberCompanies || []) as Assignment[];
  } else {
    const { data: legacyAssignments } = await supabase
      .from("company_assignments")
      .select("*, companies(name)")
      .eq("member_id", id);
    assignments = (legacyAssignments || []) as Assignment[];
  }

  if (!member) return <div style={{ padding: "40px", color: "#111827" }}>Member not found</div>;

  // --- SERVER ACTION: UPDATE PROFILE ---
  async function updateProfile(formData: FormData) {
    "use server";
    const supabase = await createClient();
    
    const updates = {
      first_name: formData.get("first_name"),
      last_name: formData.get("last_name"),
      email: formData.get("email"),
      mobile_phone: formData.get("mobile_phone"),
      primary_phone: formData.get("primary_phone"),
      address_line1: formData.get("address_line1"),
      address_line2: formData.get("address_line2"),
      city: formData.get("city"),
      state: formData.get("state"),
      postal_code: formData.get("postal_code"),
      birthday: formData.get("birthday") || null, // Handle empty date
      start_date: formData.get("start_date") || null,
      end_date: formData.get("end_date") || null,
    };

    const { error } = await supabase.from("team_members").update(updates).eq("id", id);
    if (error) {
      throw new Error(error.message);
    }
    revalidatePath(`/dashboard/the-unit/${id}`);
    revalidatePath("/dashboard/the-unit");
  }

  // Styles
  const labelStyle = { display: "block", fontSize: "12px", fontWeight: 600, color: "#6B7280", marginBottom: "6px", textTransform: "uppercase" as const };
  const inputStyle = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #D1D5DB", marginBottom: "18px", color: "#111827", backgroundColor: "#fff" };
  const sectionTitleStyle = { borderBottom: "1px solid #E5E7EB", paddingBottom: "10px", marginBottom: "20px", color: "#111827", marginTop: "30px" };

  return (
    <div style={{ padding: "40px", backgroundColor: "#F3F4F6", minHeight: "100vh", color: "#111827" }}>
    <div style={{ fontFamily: "sans-serif", maxWidth: "1100px", margin: "0 auto", paddingBottom: "100px" }}>
      
      {/* HEADER */}
      <div style={{ marginBottom: "30px" }}>
        <Link href="/dashboard/the-unit" style={{ color: "#2563eb", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>← Back to Team List</Link>
        <h1 style={{ margin: "10px 0 5px 0", color: "#111827" }}>
            {member.first_name ? `${member.first_name} ${member.last_name}` : member.email}
        </h1>
        <div style={{ display: "flex", gap: "10px" }}>
            <span style={{ fontSize: "12px", background: "#E0E7FF", color: "#3730A3", padding: "4px 10px", borderRadius: "999px", fontWeight: 700 }}>
                {member.role || "Team Member"}
            </span>
            <span style={{ fontSize: "12px", background: (member.status || "").toLowerCase() === 'active' ? '#DCFCE7' : '#FFFBEB', color: (member.status || "").toLowerCase() === 'active' ? '#166534' : '#B45309', padding: "4px 10px", borderRadius: "999px", fontWeight: 700 }}>
                {member.status}
            </span>
        </div>
      </div>

      <form action={updateProfile}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "40px" }}>
            
            {/* LEFT COL: CONTACT INFO */}
            <div>
                <h3 style={sectionTitleStyle}>👤 Identity & Contact</h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div>
                        <label style={labelStyle}>First Name</label>
                        <input name="first_name" defaultValue={member.first_name || ""} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Last Name</label>
                        <input name="last_name" defaultValue={member.last_name || ""} style={inputStyle} />
                    </div>
                </div>

                <label style={labelStyle}>Email Address</label>
                <input name="email" defaultValue={member.email || user.email || ""} style={inputStyle} />

                <label style={labelStyle}>Address Line 1</label>
                <input name="address_line1" defaultValue={member.address_line1 || ""} placeholder="Street address" style={inputStyle} />

                <label style={labelStyle}>Address Line 2</label>
                <input name="address_line2" defaultValue={member.address_line2 || ""} placeholder="Apt, Suite, Unit" style={inputStyle} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
                    <div>
                        <label style={labelStyle}>City</label>
                        <input name="city" defaultValue={member.city || ""} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>State</label>
                        <input name="state" defaultValue={member.state || ""} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Zip Code</label>
                        <input name="postal_code" defaultValue={member.postal_code || ""} style={inputStyle} />
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div>
                        <label style={labelStyle}>Mobile Phone</label>
                        <input name="mobile_phone" defaultValue={member.mobile_phone || ""} placeholder="(555) 123-4567" style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Primary/Work Phone</label>
                        <input name="primary_phone" defaultValue={member.primary_phone || ""} placeholder="Ext. 101" style={inputStyle} />
                    </div>
                </div>
            </div>

            {/* RIGHT COL: HR DATA */}
            <div>
                <h3 style={{ ...sectionTitleStyle, marginTop: 0 }}>📅 HR & Tenure</h3>
                
                <div style={{ backgroundColor: "#F9FAFB", padding: "20px", borderRadius: "12px", border: "1px solid #E5E7EB" }}>
                    <label style={labelStyle}>Birthday (For Notifications)</label>
                    <input type="date" name="birthday" defaultValue={member.birthday} style={inputStyle} />

                    <label style={labelStyle}>Start Date</label>
                    <input type="date" name="start_date" defaultValue={member.start_date} style={inputStyle} />

                    <label style={labelStyle}>End Date (If terminated)</label>
                    <input type="date" name="end_date" defaultValue={member.end_date} style={inputStyle} />
                </div>

                <h3 style={sectionTitleStyle}>🏢 Assigned Companies</h3>
                <ul style={{ paddingLeft: "20px", fontSize: "14px", color: "#6B7280" }}>
                    {assignments?.map((a) => (
                        <li key={a.company_id || a.company_id || a.id} style={{ marginBottom: "5px" }}>{a.companies?.name}</li>
                    ))}
                    {assignments?.length === 0 && <li>No companies assigned.</li>}
                </ul>
                <p style={{ fontSize: "11px", color: "#9CA3AF" }}>* Manage assignments on the main Team Dashboard.</p>

                <button style={{ width: "100%", padding: "12px", backgroundColor: "#111827", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer", marginTop: "20px" }}>
                    💾 Save Changes
                </button>
            </div>

        </div>
      </form>

    </div>
    </div>
  );
}
