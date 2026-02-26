import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  saveUserDnaProfileAction,
  uploadUserDnaDocumentAction,
  deleteUserDnaDocumentAction,
} from "@/app/actions";
import DnaWizard from "@/components/dna/DnaWizard";

export const dynamic = "force-dynamic";

type UserDnaDocumentRow = {
  id: string;
  file_path: string;
  file_name: string | null;
  content_type: string | null;
  created_at: string;
};

type UserDnaDocumentWithUrl = UserDnaDocumentRow & { url: string | null };

export default async function DnaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  const { data: profile } = await supabase
    .from("user_dna_profiles")
    .select("user_id, dna_profile, dna_text, brain_text, updated_at")
    .eq("user_id", user.id)
    .single();

  const { data: documents } = await supabase
    .from("user_dna_documents")
    .select("id, file_path, file_name, content_type, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const documentsWithUrls = (await Promise.all(
    ((documents || []) as UserDnaDocumentRow[]).map(async (doc) => {
      try {
        const { data: signedData } = await supabase.storage
          .from("user-dna")
          .createSignedUrl(doc.file_path, 60 * 60);
        return { ...doc, url: signedData?.signedUrl || null };
      } catch {
        return { ...doc, url: null };
      }
    })
  )) as UserDnaDocumentWithUrl[];

  const dnaProfile = (profile?.dna_profile as Record<string, string>) || {};
  const initialValues = {
    core_promise: dnaProfile.core_promise || "",
    voice_rules: dnaProfile.voice_rules || "",
    audience: dnaProfile.audience || "",
    offers: dnaProfile.offers || "",
    non_negotiables: dnaProfile.non_negotiables || "",
    scoreboard: dnaProfile.scoreboard || "",
    dna_text: profile?.dna_text || dnaProfile.text || "",
    brain_text: profile?.brain_text || "",
    notes: dnaProfile.notes || "",
  };

  return (
    <div style={{ padding: "40px", backgroundColor: "#F3F4F6", minHeight: "100vh", color: "#111827" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "28px", margin: 0 }}>My DNA</h1>
            <p style={{ margin: "6px 0 0", color: "#6B7280", fontSize: "14px" }}>
              Store your personal operating system so the Business Assistant can coach you in your voice.
            </p>
          </div>
          <Link href="/dashboard/companies" style={{ fontSize: "13px", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
            Manage Company DNA →
          </Link>
        </div>

        <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "18px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginTop: 0, marginBottom: "8px", fontSize: "16px" }}>DNA Guide (Fast Start)</h3>
            <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#6B7280" }}>
              Keep it short. You can refine later. Aim for clarity over perfection.
            </p>
            <div style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#111827" }}>
              <div>1) Core promise: the non‑negotiable outcome you deliver.</div>
              <div>2) Voice rules: tone, do‑/don’t‑say list, signature lines.</div>
              <div>3) Audience DNA: who it’s for + top problems + disqualifiers.</div>
              <div>4) Offers & outcomes: what you sell and what it produces.</div>
              <div>5) Scoreboard/KPIs: 3–5 numbers you review weekly.</div>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: "12px", color: "#6B7280" }}>
              Saved to your private DNA profile. Every save also updates a “My DNA” module in Content Hub.
              Files upload to the private “user‑dna” vault.
            </p>
          </div>

          <DnaWizard
            action={saveUserDnaProfileAction}
            initialValues={initialValues}
            title="DNA Builder"
            description="Start with the 5 core fields. The rest is optional."
            submitLabel="Save DNA"
          />

          <div style={{ display: "grid", gap: "18px" }}>
            <form
              action={uploadUserDnaDocumentAction}
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
              <h3 style={{ marginTop: 0, marginBottom: "4px", fontSize: "16px" }}>Upload DNA Files</h3>
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
                Upload File
              </button>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                Use this for long-form DNA docs, frameworks, or strategy files.
              </p>
            </form>

            <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
              <h3 style={{ marginTop: 0, marginBottom: "12px", fontSize: "16px" }}>Uploaded DNA Documents</h3>
              {documentsWithUrls.length === 0 && (
                <div style={{ fontSize: "13px", color: "#6B7280" }}>No DNA files uploaded yet.</div>
              )}
              <div style={{ display: "grid", gap: "10px" }}>
                {documentsWithUrls.map((doc) => (
                  <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: "10px" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>{doc.file_name || "DNA Document"}</div>
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
                      <form action={deleteUserDnaDocumentAction.bind(null, doc.id, doc.file_path)}>
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
