import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { updateTrainingAction } from "@/app/actions";

export const dynamic = 'force-dynamic';

export default async function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  const { id } = await params;
  const { data: item } = await supabase.from('training_modules').select('*').eq('id', id).single();

  if (!item) return <div>Module not found</div>;

  const sourceKey = String(item.source_key || "");
  const isUserDnaDoc = sourceKey.startsWith("user_dna_doc:");
  const isCompanyDnaDoc = sourceKey.startsWith("company_dna_doc:");
  let dnaFileUrl: string | null = null;
  let dnaFileName: string | null = null;

  if (isUserDnaDoc) {
    const docId = sourceKey.replace("user_dna_doc:", "");
    const { data: doc } = await supabase
      .from("user_dna_documents")
      .select("file_path, file_name")
      .eq("id", docId)
      .maybeSingle();
    if (doc?.file_path) {
      const { data: signed } = await supabase.storage
        .from("user-dna")
        .createSignedUrl(doc.file_path, 600);
      dnaFileUrl = signed?.signedUrl ?? null;
      dnaFileName = doc.file_name ?? null;
    }
  } else if (isCompanyDnaDoc) {
    const docId = sourceKey.replace("company_dna_doc:", "");
    const { data: doc } = await supabase
      .from("company_documents")
      .select("file_path, title")
      .eq("id", docId)
      .maybeSingle();
    if (doc?.file_path) {
      const { data: signed } = await supabase.storage
        .from("company-documents")
        .createSignedUrl(doc.file_path, 600);
      dnaFileUrl = signed?.signedUrl ?? null;
      dnaFileName = doc.title ?? null;
    }
  }

  // Helper to extract YouTube ID for embedding
  const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = getYouTubeId(item.video_url);

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto", paddingBottom: "100px", color: "#333" }}>
      
      <Link href="/dashboard/war-chest" style={{ color: "gray", textDecoration: "none", fontSize: "14px" }}>← Back to Hub</Link>
      
      <form action={updateTrainingAction.bind(null, id)}>
        
        {/* TITLE & DESC EDITOR */}
        <div style={{ marginTop: "20px", marginBottom: "30px" }}>
            <input 
                name="title" 
                defaultValue={item.title} 
                style={{ fontSize: "32px", fontWeight: "bold", width: "100%", border: "none", outline: "none", background: "transparent", color: "#111" }} 
                placeholder="Module Title"
            />
            <input 
                name="description" 
                defaultValue={item.description} 
                style={{ fontSize: "16px", color: "#666", width: "100%", border: "none", outline: "none", background: "transparent", marginTop: "10px" }} 
                placeholder="Short description..."
            />
            {dnaFileUrl && (
              <div style={{ marginTop: "12px" }}>
                <a
                  href={dnaFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    backgroundColor: "#111827",
                    color: "#fff",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  📎 Open DNA File{dnaFileName ? `: ${dnaFileName}` : ""}
                </a>
              </div>
            )}
        </div>

        {/* VIDEO PLAYER */}
        {videoId ? (
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "12px", backgroundColor: "black", marginBottom: "30px" }}>
                <iframe 
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} 
                    src={`https://www.youtube.com/embed/${videoId}`} 
                    title="YouTube video player" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen 
                />
            </div>
        ) : (
             <div style={{ padding: "40px", backgroundColor: "#f3f4f6", borderRadius: "12px", textAlign: "center", color: "#666", marginBottom: "30px" }}>
                📺 No video yet. Add a YouTube URL below to display the player.
             </div>
        )}

        {/* CONTENT EDITOR */}
        <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", border: "1px solid #e5e5e5" }}>
            <h3 style={{ marginTop: 0 }}>📝 Notes & SOP Content</h3>
            
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginTop: "20px" }}>Video URL (YouTube)</label>
            <input 
                name="video_url" 
                defaultValue={item.video_url || ""} 
                placeholder="https://www.youtube.com/watch?v=..." 
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "5px" }} 
            />

            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginTop: "20px" }}>Training Body</label>
            <textarea 
                name="content_body" 
                rows={15} 
                defaultValue={item.content_body || ""} 
                placeholder="Write your SOPs, scripts, or notes here..." 
                style={{ width: "100%", padding: "15px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "5px", fontFamily: "monospace", lineHeight: "1.5" }} 
            />

            <div style={{ textAlign: "right", marginTop: "20px" }}>
                <button style={{ backgroundColor: "black", color: "white", padding: "12px 24px", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                    💾 Save Changes
                </button>
            </div>
        </div>

      </form>

    </div>
  );
}
