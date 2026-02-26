import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import OpenAI from "openai";

type SearchParams = Record<string, string | string[] | undefined>;

const getParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] || "" : value || "";

export default async function NewLeadPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  const sp = await searchParams;
  const fname = getParam(sp?.fname);
  const lname = getParam(sp?.lname);
  const email = getParam(sp?.email);
  const company = getParam(sp?.company);
  const location = getParam(sp?.location);
  const doAnalyze = getParam(sp?.analyze) === "true";

  let aiResult = null;

  if (doAnalyze && fname && company) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    try {
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are an expert Lead Qualification AI. Return JSON with: score (0-100), reasoning, search_dorks (array of 3 strings), icebreaker, pros (array), cons (array)."
          },
          { role: "user", content: `Prospect: ${fname} ${lname}. Email: ${email}. Location: ${location}. Company: ${company}.` },
        ],
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
      });
      aiResult = JSON.parse(completion.choices[0].message.content || "{}");
    } catch (e) {
      console.error("AI Error", e);
    }
  }

  async function saveLead(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const name = formData.get("name") as string;
    const company = formData.get("company") as string;
    const email = formData.get("email") as string;
    await supabase.from("leads").insert({ name, company, email, status: "New", value: 0 });
    redirect("/dashboard/leads");
  }

  // Common Input Style to enforce visibility
  const inputStyle = {
    width: "100%",
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    color: "black",            // Force text black
    backgroundColor: "white",  // Force background white
    fontSize: "14px"
  };

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "900px", margin: "0 auto", paddingBottom: "40px", color: "#333" }}>
      <Link href="/dashboard/leads" style={{ color: "gray", textDecoration: "none", fontSize: "12px" }}>← Back to Pipeline</Link>
      <h1 style={{ marginBottom: "10px", color: "black" }}>🎯 Lead Qualifier</h1>
      
      <div style={{ padding: "25px", border: "1px solid #e5e5e5", borderRadius: "12px", background: "white", marginBottom: "30px" }}>
        <form method="GET" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div><label style={{ fontSize: "12px", fontWeight: "bold" }}>First Name</label><input name="fname" defaultValue={fname} style={inputStyle} /></div>
          <div><label style={{ fontSize: "12px", fontWeight: "bold" }}>Last Name</label><input name="lname" defaultValue={lname} style={inputStyle} /></div>
          <div><label style={{ fontSize: "12px", fontWeight: "bold" }}>Company</label><input name="company" defaultValue={company} style={inputStyle} /></div>
          <div><label style={{ fontSize: "12px", fontWeight: "bold" }}>Location</label><input name="location" defaultValue={location} style={inputStyle} /></div>
          <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: "12px", fontWeight: "bold" }}>Email</label><input name="email" defaultValue={email} style={inputStyle} /></div>
          <div style={{ gridColumn: "span 2", marginTop: "10px" }}>
            <button name="analyze" value="true" type="submit" style={{ width: "100%", padding: "12px", background: "black", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>🚀 Analyze & Qualify Lead</button>
          </div>
        </form>
      </div>

      {aiResult && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "30px" }}>
          <div>
            <div style={{ backgroundColor: aiResult.score > 70 ? "#16a34a" : aiResult.score > 40 ? "#ca8a04" : "#dc2626", color: "white", padding: "30px", borderRadius: "12px", textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "64px", fontWeight: "bold" }}>{aiResult.score}</div>
              <div style={{ fontSize: "12px" }}>LEAD SCORE</div>
            </div>
             <form action={saveLead}>
              <input type="hidden" name="name" value={`${fname} ${lname}`} />
              <input type="hidden" name="company" value={`${company} (${location})`} />
              <input type="hidden" name="email" value={email} />
              <button style={{ width: "100%", padding: "12px", background: "#333", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>💾 Save Lead</button>
            </form>
          </div>
          <div>
            <h3>Qualification Report</h3>
            <p>{aiResult.reasoning}</p>
            <div style={{ background: "#f0fdf4", padding: "15px", borderRadius: "8px", marginBottom: "15px" }}><strong>✅ Pros:</strong> <ul>{aiResult.pros?.map((p: string) => <li key={p}>{p}</li>)}</ul></div>
            <div style={{ background: "#fef2f2", padding: "15px", borderRadius: "8px", marginBottom: "15px" }}><strong>⚠️ Risks:</strong> <ul>{aiResult.cons?.map((c: string) => <li key={c}>{c}</li>)}</ul></div>
             <div style={{ padding: "15px", background: "#f0f9ff", borderRadius: "8px" }}>
              <strong>Search Intel:</strong>
              {aiResult.search_dorks?.map((q:string) => (
                <div key={q}><a href={`https://www.google.com/search?q=${encodeURIComponent(q)}`} target="_blank" style={{ color: "blue" }}>🔎 {q}</a></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
