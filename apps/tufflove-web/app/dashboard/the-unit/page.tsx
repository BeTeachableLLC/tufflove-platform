import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createCompanyAction, inviteCompanyMemberAction, deleteMemberAction } from "@/app/actions";

export const dynamic = 'force-dynamic';

type CompanyMembershipRow = {
  role: string | null;
  companies: {
    id: string;
    name: string;
  } | null;
};

type CompanyOption = {
  id: string;
  name: string;
  role: string | null;
};

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  if (user.email) {
    await supabase
      .from("team_members")
      .update({ email: user.email })
      .eq("user_id", user.id)
      .is("email", null);
  }

  // Fetch Team Members
  const { data: members } = await supabase.from('team_members').select('*').order('created_at', { ascending: false });
  const { data: memberships } = await supabase
    .from("company_members")
    .select("role, companies(id, name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const companies = ((memberships || []) as unknown as CompanyMembershipRow[])
    .map((row) => ({
      ...(row.companies || {}),
      role: row.role,
    }))
    .filter((company): company is CompanyOption => Boolean(company && company.id));

  return (
    <div style={{ padding: "40px", backgroundColor: "#F3F4F6", minHeight: "100vh", color: "#111827" }}>
      <div style={{ fontFamily: "sans-serif", maxWidth: "1100px", margin: "0 auto", paddingBottom: "100px" }}>
        {/* HEADER */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", margin: "0 0 6px 0", color: "#111827" }}>👥 Team Management</h1>
          <p style={{ color: "#6B7280", margin: 0 }}>Invite partners and manage access.</p>
        </div>

        {/* COMPANY + STAFF */}
        <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginBottom: "32px" }}>
          <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #E5E7EB", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginTop: 0, fontSize: "16px", color: "#111827" }}>Add Company</h3>
            <form action={createCompanyAction} style={{ display: "grid", gap: "10px" }}>
              <input
                name="name"
                placeholder="Company name"
                required
                style={{ padding: "10px", borderRadius: "8px", border: "1px solid #D1D5DB", color: "#111827" }}
              />
              <input
                name="website"
                placeholder="Company website (optional)"
                type="url"
                style={{ padding: "10px", borderRadius: "8px", border: "1px solid #D1D5DB", color: "#111827" }}
              />
              <button
                style={{ backgroundColor: "#111827", color: "#fff", padding: "10px 18px", borderRadius: "8px", border: "none", fontWeight: 600, cursor: "pointer" }}
              >
                Create Company
              </button>
            </form>
          </div>

          <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #E5E7EB", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginTop: 0, fontSize: "16px", color: "#111827" }}>Invite Company Staff</h3>
            <form action={inviteCompanyMemberAction} style={{ display: "grid", gap: "10px" }}>
              <select
                name="company_id"
                required
                disabled={companies.length === 0}
                style={{ padding: "10px", borderRadius: "8px", border: "1px solid #D1D5DB", color: "#111827", backgroundColor: "#fff" }}
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
              <input
                name="email"
                type="email"
                placeholder="colleague@example.com"
                required
                style={{ padding: "10px", borderRadius: "8px", border: "1px solid #D1D5DB", color: "#111827" }}
              />
              <select
                name="role"
                defaultValue="rep"
                style={{ padding: "10px", borderRadius: "8px", border: "1px solid #D1D5DB", color: "#111827", backgroundColor: "#fff" }}
              >
                <option value="rep">Rep</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
              <button
                disabled={companies.length === 0}
                style={{ backgroundColor: "#111827", color: "#fff", padding: "10px 18px", borderRadius: "8px", border: "none", fontWeight: 600, cursor: "pointer" }}
              >
                Send Invite 📩
              </button>
            </form>
            {companies.length === 0 && (
              <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "8px" }}>
                Add a company first to invite staff.
              </p>
            )}
          </div>
        </div>

        {/* MEMBER LIST */}
        <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
              <tr>
                <th style={{ textAlign: "left", padding: "15px", fontSize: "12px", color: "#6B7280" }}>EMAIL</th>
                <th style={{ textAlign: "left", padding: "15px", fontSize: "12px", color: "#6B7280" }}>STATUS</th>
                <th style={{ textAlign: "left", padding: "15px", fontSize: "12px", color: "#6B7280" }}>ROLE</th>
                <th style={{ textAlign: "right", padding: "15px", fontSize: "12px", color: "#6B7280" }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {members?.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "15px", fontWeight: 500, color: "#111827" }}>
                    {m.email || (m.user_id === user.id ? user.email : "")}
                  </td>
                  <td style={{ padding: "15px" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 700,
                        backgroundColor: m.status === "Active" ? "#DCFCE7" : "#F3F4F6",
                        color: m.status === "Active" ? "#166534" : "#4B5563",
                      }}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td style={{ padding: "15px", fontSize: "13px", color: "#111827" }}>
                    {m.role}
                    {m.user_id === user.id && (
                      <span style={{ marginLeft: "8px", fontSize: "11px", backgroundColor: "#E0E7FF", color: "#3730A3", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
                        You
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "15px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                      <Link href={`/dashboard/the-unit/${m.id}`} style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
                        Edit
                      </Link>
                      <form action={deleteMemberAction.bind(null, m.id)}>
                        <button style={{ color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>
                          Remove
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {(!members || members.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ padding: "30px", textAlign: "center", color: "#9CA3AF" }}>
                    No team members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
