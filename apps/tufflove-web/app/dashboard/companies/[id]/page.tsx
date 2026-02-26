import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  saveCompanyDnaProfileAction,
  enqueueCompanySeoJobAction,
  uploadCompanyDnaDocumentAction,
  deleteCompanyDocumentAction,
} from "@/app/actions";
import DnaWizard from "@/components/dna/DnaWizard";

export const dynamic = "force-dynamic";

type CompanyDocumentRow = {
  id: string;
  file_path: string;
  title: string | null;
  doc_type: string | null;
  created_at: string;
};
type CompanyDocumentWithUrl = CompanyDocumentRow & { url: string | null };

export default async function CompanyDnaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: { seo?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  const { id: companyId } = await params;
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, description, website")
    .eq("id", companyId)
    .single();
  if (!company) return <div>Company not found.</div>;

  const seoNotice = (() => {
    switch (searchParams?.seo) {
      case "queued":
        return { tone: "#065f46", message: "SEO scan queued. We will report back once the crawl completes." };
      case "missing_website":
        return { tone: "#b45309", message: "Add a company website before running an SEO scan." };
      case "limit_day":
        return { tone: "#b45309", message: "Daily limit reached (2 scans/day). Try again tomorrow." };
      case "limit_month":
        return { tone: "#b45309", message: "Monthly limit reached (6 scans/month). Try again next month." };
      case "error":
        return { tone: "#b91c1c", message: "Could not queue the SEO scan. Try again in a minute." };
      default:
        return null;
    }
  })();

  const { data: latestReport } = await supabase
    .from("company_seo_reports")
    .select("id, created_at, score, summary")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestJob } = await supabase
    .from("company_seo_jobs")
    .select("id, status, requested_at, error")
    .eq("company_id", companyId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("company_profiles")
    .select("company_id, dna_profile, brain_profile, notes, updated_at")
    .eq("company_id", companyId)
    .maybeSingle();

  const { data: documents } = await supabase
    .from("company_documents")
    .select("id, file_path, title, doc_type, created_at")
    .eq("company_id", companyId)
    .eq("doc_type", "dna")
    .order("created_at", { ascending: false });

  const documentsWithUrls = (await Promise.all(
    ((documents || []) as CompanyDocumentRow[]).map(async (doc) => {
      try {
        const { data: signedData } = await supabase.storage
          .from("company-documents")
          .createSignedUrl(doc.file_path, 60 * 60);
        return { ...doc, url: signedData?.signedUrl || null };
      } catch {
        return { ...doc, url: null };
      }
    })
  )) as CompanyDocumentWithUrl[];

  const dnaProfile = (profile?.dna_profile as Record<string, string>) || {};
  const brainProfile = (profile?.brain_profile as Record<string, string>) || {};
  const initialValues = {
    core_promise: dnaProfile.core_promise || "",
    voice_rules: dnaProfile.voice_rules || "",
    audience: dnaProfile.audience || "",
    offers: dnaProfile.offers || "",
    non_negotiables: dnaProfile.non_negotiables || "",
    scoreboard: dnaProfile.scoreboard || "",
    dna_text: dnaProfile.text || "",
    brain_text: brainProfile.text || "",
    notes: dnaProfile.notes || profile?.notes || "",
  };

  return (
    <div style={{ padding: "40px", backgroundColor: "#F3F4F6", minHeight: "100vh", color: "#111827" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "28px", margin: 0 }}>{company.name} DNA</h1>
            <p style={{ margin: "6px 0 0", color: "#6B7280", fontSize: "14px" }}>
              Store company DNA so the Business Assistant can coach the team with the right context.
            </p>
          </div>
          <Link href="/dashboard/companies" style={{ fontSize: "13px", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
            Back to Companies →
          </Link>
        </div>

        <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "18px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginTop: 0, marginBottom: "8px", fontSize: "16px" }}>Company DNA Guide</h3>
            <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#6B7280" }}>
              Capture the operating truth so your team and the Assistant stay aligned.
            </p>
            <div style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#111827" }}>
              <div>1) Core promise: what the company must deliver, always.</div>
              <div>2) Voice rules: how the company communicates internally/externally.</div>
              <div>3) Audience DNA: target customers, pains, and disqualifiers.</div>
              <div>4) Offers & outcomes: products/services + measurable results.</div>
              <div>5) Scoreboard/KPIs: the 3–7 numbers reviewed weekly.</div>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: "12px", color: "#6B7280" }}>
              Saved to the company DNA profile. Every save also updates a Company DNA module in Content Hub.
              Files upload to the private “company‑documents” vault.
            </p>
          </div>

          <DnaWizard
            action={saveCompanyDnaProfileAction.bind(null, companyId)}
            initialValues={initialValues}
            title="Company DNA Builder"
            description="Focus on the five essentials first. Everything else is optional."
            submitLabel="Save Company DNA"
          />

          <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "18px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginTop: 0, marginBottom: "8px", fontSize: "16px" }}>SEO Intelligence (TUFF LOVE)</h3>
            <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#6B7280" }}>
              Full‑crawl audit on demand. Limits: 2 scans/day, 6 scans/month per company.
            </p>
            <div style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#111827" }}>
              <div><strong>Website:</strong> {company.website || "Not set yet"}</div>
              {latestJob && (
                <div>
                  <strong>Latest job:</strong> {latestJob.status}{" "}
                  <span style={{ color: "#6B7280" }}>
                    ({latestJob.requested_at ? new Date(latestJob.requested_at).toLocaleString() : "pending"})
                  </span>
                </div>
              )}
              {latestReport && (
                <div>
                  <strong>Latest report:</strong> {latestReport.created_at ? new Date(latestReport.created_at).toLocaleDateString() : "recent"}{" "}
                  {latestReport.score !== null && latestReport.score !== undefined ? `· Score ${latestReport.score}` : ""}
                </div>
              )}
            </div>

            {seoNotice && (
              <div style={{ marginTop: "10px", fontSize: "12px", color: seoNotice.tone }}>
                {seoNotice.message}
              </div>
            )}

            <form action={enqueueCompanySeoJobAction.bind(null, companyId)} style={{ marginTop: "12px" }}>
              <button
                style={{
                  backgroundColor: "#0F172A",
                  color: "#fff",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                disabled={!company.website}
              >
                Run Full SEO Scan
              </button>
            </form>

            {latestReport?.summary && (
              <div style={{ marginTop: "12px", fontSize: "13px", color: "#374151" }}>
                <strong>Summary:</strong> {latestReport.summary}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: "18px" }}>
            <form
              action={uploadCompanyDnaDocumentAction.bind(null, companyId)}
              encType="multipart/form-data"
              style={{
                backgroundColor: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                display: "grid",
                gap: "12px",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: "4px", fontSize: "16px" }}>Upload Company DNA</h3>
              <input name="title" placeholder="Document title (optional)" style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }} />
              <input name="file" type="file" required style={{ padding: "8px" }} />
              <button
                style={{
                  backgroundColor: "#2563eb",
                  color: "#fff",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Upload DNA File
              </button>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                Upload long-form DNA, playbooks, or executive guidance docs.
              </p>
            </form>

            <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
              <h3 style={{ marginTop: 0, marginBottom: "12px", fontSize: "16px" }}>Company DNA Files</h3>
              {documentsWithUrls.length === 0 && (
                <div style={{ fontSize: "13px", color: "#6B7280" }}>No DNA files uploaded yet.</div>
              )}
              <div style={{ display: "grid", gap: "10px" }}>
                {documentsWithUrls.map((doc) => (
                  <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: "10px" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>{doc.title || "Company DNA Document"}</div>
                      <div style={{ fontSize: "11px", color: "#6B7280" }}>
                        {doc.created_at ? new Date(doc.created_at).toLocaleString() : "Uploaded recently"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                      {doc.url && (
                        <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                          View
                        </a>
                      )}
                      <form action={deleteCompanyDocumentAction.bind(null, doc.id, doc.file_path, companyId)}>
                        <button style={{ fontSize: "12px", color: "#DC2626", fontWeight: 700, border: "none", background: "transparent", cursor: "pointer" }}>
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
