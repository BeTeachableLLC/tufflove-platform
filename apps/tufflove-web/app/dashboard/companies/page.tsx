import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createCompanyAction } from "@/app/actions";

export const dynamic = "force-dynamic";

type CompanyMembershipRow = {
  role: string | null;
  companies: {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
  } | null;
};

type CompanyCard = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  role: string | null;
};

export default async function CompaniesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  const { data: memberships } = await supabase
    .from("company_members")
    .select("role, companies(id, name, slug, description)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: ownedCompanies } = await supabase
    .from("companies")
    .select("id, name, slug, description")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  const membershipCompanies = ((memberships || []) as unknown as CompanyMembershipRow[])
    .map((row) => ({
      ...(row.companies || {}),
      role: row.role,
    }))
    .filter((company): company is CompanyCard => Boolean(company && company.id));

  const ownerCompanies = (ownedCompanies || []).map((company) => ({
    ...company,
    role: "owner",
  }));

  const companies = Array.from(
    new Map(
      [...membershipCompanies, ...ownerCompanies].map((company) => [company.id, company])
    ).values()
  );

  return (
    <div style={{ padding: "40px", backgroundColor: "#F3F4F6", minHeight: "100vh", color: "#111827" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "28px", margin: 0 }}>Companies</h1>
            <p style={{ margin: "6px 0 0", color: "#6B7280", fontSize: "14px" }}>
              Manage the companies you own or operate.
            </p>
          </div>
        </div>

        <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "20px", marginBottom: "30px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
          <h3 style={{ marginTop: 0, marginBottom: "12px", fontSize: "16px" }}>Add Company</h3>
          <form action={createCompanyAction} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <input
              name="name"
              placeholder="Company name"
              required
              style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
            />
            <input
              name="website"
              placeholder="Company website (optional)"
              type="url"
              style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
            />
            <button
              style={{
                gridColumn: "span 2",
                backgroundColor: "#111827",
                color: "#fff",
                padding: "10px 18px",
                borderRadius: "8px",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Create Company
            </button>
          </form>
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          {companies.map((company) => (
            <div key={company.id} style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 700 }}>{company.name}</div>
                  <div style={{ fontSize: "12px", color: "#6B7280" }}>{company.role ? `Role: ${company.role}` : "Member"}</div>
                </div>
                <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                  <Link href={`/dashboard/companies/${company.id}`} style={{ fontSize: "13px", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                    Manage DNA →
                  </Link>
                  <Link href={`/dashboard/level10/${company.id}`} style={{ fontSize: "13px", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                    Open Level 10 →
                  </Link>
                </div>
              </div>
              {company.description && (
                <p style={{ margin: "8px 0 0", color: "#6B7280", fontSize: "13px" }}>{company.description}</p>
              )}
            </div>
          ))}

          {companies.length === 0 && (
            <div style={{ padding: "36px", textAlign: "center", color: "#6B7280", backgroundColor: "#fff", borderRadius: "12px", border: "1px dashed #E5E7EB" }}>
              <strong>No Mission Detected.</strong>
              <div>Initialize your first Company to begin the campaign.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
