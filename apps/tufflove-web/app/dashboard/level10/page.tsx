import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import DnaWarningBanner from "@/components/dna/DnaWarningBanner";
import { getMissingDnaFields } from "@/lib/dna";

export const dynamic = "force-dynamic";

type CompanyMembershipRow = {
  role: string | null;
  companies: {
    id: string;
    name: string;
  } | null;
};

type CompanyCard = {
  id: string;
  name: string;
  role: string | null;
};

export default async function Level10IndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  const { data: memberships } = await supabase
    .from("company_members")
    .select("role, companies(id, name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: dnaProfileRow } = await supabase
    .from("user_dna_profiles")
    .select("dna_profile")
    .eq("user_id", user.id)
    .maybeSingle();

  const missingFields = getMissingDnaFields((dnaProfileRow?.dna_profile as Record<string, string>) || {});

  const companies = ((memberships || []) as unknown as CompanyMembershipRow[])
    .map((row) => ({
      ...(row.companies || {}),
      role: row.role,
    }))
    .filter((company): company is CompanyCard => Boolean(company && company.id));

  return (
    <div style={{ padding: "40px", backgroundColor: "#F3F4F6", minHeight: "100vh", color: "#111827" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <div style={{ marginBottom: "28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "28px", margin: 0 }}>Level 10 Meetings</h1>
            <p style={{ margin: "6px 0 0", color: "#6B7280", fontSize: "14px" }}>
              Run weekly accountability meetings by company.
            </p>
          </div>
          <Link
            href="/dashboard/companies"
            style={{
              backgroundColor: "#111827",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            Add Company
          </Link>
        </div>

        <DnaWarningBanner
          missingFields={missingFields}
          title="Finish your DNA to personalize Level 10"
          description="Add your core DNA so agendas and summaries reflect your voice and priorities."
          ctaHref="/dashboard/the-code"
          ctaLabel="Complete DNA →"
        />

        <div style={{ display: "grid", gap: "14px" }}>
          {companies.map((company) => (
            <Link key={company.id} href={`/dashboard/level10/${company.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: 700 }}>{company.name}</div>
                    <div style={{ fontSize: "12px", color: "#6B7280" }}>{company.role ? `Role: ${company.role}` : "Member"}</div>
                  </div>
                  <div style={{ fontSize: "13px", color: "#2563eb", fontWeight: 600 }}>
                    Open →
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {companies.length === 0 && (
            <div style={{ padding: "36px", textAlign: "center", color: "#6B7280", backgroundColor: "#fff", borderRadius: "12px", border: "1px dashed #E5E7EB" }}>
              Add a company first to start Level 10 meetings.{" "}
              <Link href="/dashboard/companies" style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                Create one now
              </Link>
              .
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
