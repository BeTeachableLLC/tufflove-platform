import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createTrainingAction } from "@/app/actions";
import DnaWarningBanner from "@/components/dna/DnaWarningBanner";
import { getMissingDnaFields } from "@/lib/dna";

export const dynamic = 'force-dynamic';

export default async function ContentHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  // Fetch Modules
  const { data: modules } = await supabase.from('training_modules').select('*').order('created_at', { ascending: false });
  const { data: dnaProfileRow } = await supabase
    .from("user_dna_profiles")
    .select("dna_profile")
    .eq("user_id", user.id)
    .maybeSingle();
  const missingFields = getMissingDnaFields((dnaProfileRow?.dna_profile as Record<string, string>) || {});

  return (
    <div style={{ padding: "40px", backgroundColor: "#F3F4F6", minHeight: "100vh", color: "#111827" }}>
      <div style={{ fontFamily: "sans-serif", maxWidth: "1100px", margin: "0 auto", paddingBottom: "100px" }}>
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <div>
            <h1 style={{ color: "#111827", margin: "0 0 5px 0" }}>📚 Content Hub</h1>
            <p style={{ color: "#6B7280", margin: 0 }}>Masterclasses, SOPs, and Training Materials.</p>
          </div>
          <form action={createTrainingAction}>
            <button style={{ backgroundColor: "#111827", color: "#fff", padding: "10px 20px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "600" }}>
              + New Module
            </button>
          </form>
        </div>

        <DnaWarningBanner
          missingFields={missingFields}
          title="Finish your DNA to personalize Content Hub"
          description="Add your core DNA so auto-published content reflects your voice and priorities."
          ctaHref="/dashboard/dna"
          ctaLabel="Complete DNA →"
        />

        {/* GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
          {modules?.map((item) => (
            <Link key={item.id} href={`/dashboard/training/${item.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", overflow: "hidden", height: "100%", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                {/* Thumbnail Placeholder */}
                <div style={{ height: "140px", backgroundColor: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px" }}>
                  {item.category === 'Sales' ? '💰' : item.category === 'DNA' ? '🧬' : '📺'}
                </div>
                <div style={{ padding: "20px" }}>
                  <div style={{ fontSize: "11px", color: "#2563eb", fontWeight: "bold", textTransform: "uppercase", marginBottom: "5px" }}>{item.category || "General"}</div>
                  <h3 style={{ margin: "0 0 10px 0", fontSize: "18px", color: "#111827" }}>{item.title}</h3>
                  <p style={{ fontSize: "13px", color: "#6B7280", margin: 0, lineHeight: "1.4" }}>
                    {item.description?.slice(0, 80)}...
                  </p>
                </div>
              </div>
            </Link>
          ))}

          {(!modules || modules.length === 0) && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "50px", color: "#6B7280", backgroundColor: "#fff", borderRadius: "12px", border: "1px dashed #E5E7EB" }}>
              No training modules found. Click &quot;+ New Module&quot; to start.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
