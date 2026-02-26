"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  updateLeadAction, 
  runDeepResearchAction, 
  generateTuffLoveScriptAction, 
  convertLeadToDealAction,
  deleteLeadAction,
  saveLeadNotesAction,
  updateLeadNoteEntryAction,
  deleteLeadNoteEntryAction
} from "@/app/actions";

type LeadResearchSnapshot = {
  searched_at?: string;
  quick_links?: {
    google?: string;
    linkedin?: string;
    facebook?: string;
  };
  people_search?: {
    core?: {
      match?: {
        name?: string | null;
        company?: string | null;
        email?: string | null;
        phone?: string | null;
        linkedin_url?: string | null;
      };
    };
    web?: {
      results?: Array<{ title?: string | null; link?: string | null }>;
    };
  };
};

type LeadVerification = {
  id: string;
  provider?: string | null;
  status?: string | null;
  confidence?: number | null;
  matched_fields?: string[] | null;
  evidence?: {
    match?: {
      name?: string | null;
      company?: string | null;
    };
    results?: Array<{ title?: string | null; link?: string | null }>;
  } | null;
  created_at?: string | null;
};

type NoteEntry = {
  id: string;
  created_at?: string | null;
  content?: string | null;
};

type ArchivedNote = {
  id: string;
  createdAt: string;
  content: string;
};

type Lead = {
  id: string;
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  lead_notes?: string | null;
  status?: string | null;
  pipeline_stage?: string | null;
  campaign?: string | null;
  ai_generated_script?: string | null;
  verified_email?: string | null;
  verified_phone?: string | null;
  linkedin_url?: string | null;
  research_last_run?: string | null;
  research_status?: string | null;
  research_error?: string | null;
  company?: string | null;
  name?: string | null;
  lead_research_snapshot?: LeadResearchSnapshot | null;
};

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Unknown error";

export default function InteractiveLeadView({
  lead,
  verifications = [],
  noteEntries = [],
}: {
  lead: Lead;
  verifications?: LeadVerification[];
  noteEntries?: NoteEntry[];
}) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    company_name: lead.company_name || "",
    contact_name: lead.contact_name || "",
    email: lead.email || "",
    phone: lead.phone || "",
    lead_notes: lead.lead_notes || "",
    status: lead.status || "New",
    pipeline_stage: lead.pipeline_stage || "Prospecting",
    campaign: lead.campaign || "",
  });

  const [loading, setLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchMessage, setResearchMessage] = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptText, setScriptText] = useState(lead.ai_generated_script || "Click Generate...");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const [noteEntryBusyId, setNoteEntryBusyId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setFormData({
      company_name: lead.company_name || "",
      contact_name: lead.contact_name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      lead_notes: lead.lead_notes || "",
      status: lead.status || "New",
      pipeline_stage: lead.pipeline_stage || "Prospecting",
      campaign: lead.campaign || "",
    });
    setScriptText(lead.ai_generated_script || "Click Generate...");
    setEditingNoteId(null);
    setEditingNoteContent("");
    setNoteEntryBusyId(null);
  }, [lead]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  const handleFocus = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const val = e.target.value;
    if (val === "New Prospect" || val === "Pending..." || val === "New Deal") {
      setFormData({ ...formData, [e.target.name]: "" });
    }
  };

  const runAction = async (
    _name: string,
    fn: () => Promise<{ error?: string; warning?: string } | void>,
    setLoader: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    setLoader(true);
    try {
      const result = await fn();
      if (result?.error) {
        alert("Error: " + result.error);
        return;
      }
      if (result?.warning) {
        alert(result.warning);
      }
      router.refresh();
    } catch (err: unknown) {
      alert("Error: " + getErrorMessage(err));
    } finally {
      setLoader(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const data = new FormData();
      Object.entries(formData).forEach(([k, v]) => data.append(k, v));
      const result = await updateLeadAction(lead.id, data);
      if (result?.error) {
        alert("Save failed: " + result.error);
        return;
      }
      alert("✅ Changes Saved!");
      router.refresh();
    } catch (err: unknown) {
      alert("Save failed: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    try {
      const result = await saveLeadNotesAction(lead.id, formData.lead_notes || "");
      if (result?.error) {
        alert("Save failed: " + result.error);
        return;
      }
      if (result?.lead_notes !== undefined) {
        setFormData((prev) => ({ ...prev, lead_notes: result.lead_notes }));
      }
      if (result?.warning) {
        alert(result.warning);
      }
      alert("✅ Notes Saved!");
      router.refresh();
    } catch (err: unknown) {
      alert("Save failed: " + getErrorMessage(err));
    } finally {
      setNotesSaving(false);
    }
  };

  const handleDelete = async () => {
    if(!confirm("Are you sure you want to DELETE this lead? This cannot be undone.")) return;
    setIsDeleting(true);
    try {
      await deleteLeadAction(lead.id);
      window.location.href = "/dashboard/engine";
    } catch (err: unknown) {
      alert("Delete failed: " + getErrorMessage(err));
      setIsDeleting(false);
    }
  };

  const handleResearch = async () => {
    setResearchLoading(true);
    setResearchMessage("");
    try {
      const result = await runDeepResearchAction(lead.id, {
        email: formData.email,
        phone: formData.phone,
        contactName: formData.contact_name,
        companyName: formData.company_name,
        linkedinUrl: lead.linkedin_url || "",
      });
      if (result?.message) setResearchMessage(result.message);
      router.refresh();
    } catch (err: unknown) {
      alert("Error: " + getErrorMessage(err));
    } finally {
      setResearchLoading(false);
    }
  };

  const handleEditNoteEntry = (entry: NoteEntry) => {
    setEditingNoteId(entry.id);
    setEditingNoteContent(entry.content || "");
  };

  const handleCancelNoteEdit = () => {
    setEditingNoteId(null);
    setEditingNoteContent("");
  };

  const handleUpdateNoteEntry = async (entryId: string) => {
    setNoteEntryBusyId(entryId);
    try {
      const result = await updateLeadNoteEntryAction(entryId, lead.id, editingNoteContent);
      if (result?.error) {
        alert("Update failed: " + result.error);
        return;
      }
      alert("✅ Note Updated!");
      handleCancelNoteEdit();
      router.refresh();
    } catch (err: unknown) {
      alert("Update failed: " + getErrorMessage(err));
    } finally {
      setNoteEntryBusyId(null);
    }
  };

  const handleDeleteNoteEntry = async (entryId: string) => {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    setNoteEntryBusyId(entryId);
    try {
      const result = await deleteLeadNoteEntryAction(entryId, lead.id);
      if (result?.error) {
        alert("Delete failed: " + result.error);
        return;
      }
      alert("✅ Note Deleted!");
      router.refresh();
    } catch (err: unknown) {
      alert("Delete failed: " + getErrorMessage(err));
    } finally {
      setNoteEntryBusyId(null);
    }
  };

  const handleGenerateScript = async () => {
    setScriptLoading(true);
    try {
      const result = await generateTuffLoveScriptAction(lead.id, "Construction", {
        companyName: formData.company_name,
        contactName: formData.contact_name,
        email: formData.email,
        phone: formData.phone,
        linkedinUrl: lead.linkedin_url || "",
        leadNotes: formData.lead_notes,
        researchSnapshot: lead.lead_research_snapshot || null,
      });
      if (result?.error) {
        alert("Error: " + result.error);
        return;
      }
      if (result?.script) {
        setScriptText(result.script);
      }
      if (result?.warning) {
        alert(result.warning);
      }
      router.refresh();
    } catch (err: unknown) {
      alert("Error: " + getErrorMessage(err));
    } finally {
      setScriptLoading(false);
    }
  };

  const inputStyle = { width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "#fff", border: "1px solid #D1D5DB", color: "#111827", outline: "none" };
  const displayEmail = lead.verified_email || lead.email || "Not found";
  const displayPhone = lead.verified_phone || lead.phone || "Not found";
  const fallbackLinkedIn = `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(`${lead.contact_name || lead.name || ""} ${lead.company_name || lead.company || ""}`.trim())}`;
  const displayLinkedIn = lead.linkedin_url || fallbackLinkedIn;
  const lastRun = lead.research_last_run ? new Date(lead.research_last_run).toLocaleString() : "";
  const hasResearchData = Boolean(lead.verified_email || lead.verified_phone || lead.linkedin_url);
  const showResearchResults = lead.research_status === "Completed" || hasResearchData;
  const searchQuery = `${formData.contact_name || ""} ${formData.company_name || ""}`.trim() || formData.email || "";
  const encodedQuery = encodeURIComponent(searchQuery);
  const recentVerifications = Array.isArray(verifications) ? verifications.slice(0, 3) : [];
  const savedSnapshot = lead.lead_research_snapshot || null;
  const savedQuickLinks = savedSnapshot?.quick_links || {};
  const savedSearchTime = savedSnapshot?.searched_at ? new Date(savedSnapshot.searched_at).toLocaleString() : "";
  const archivedNotes: ArchivedNote[] = Array.isArray(noteEntries) && noteEntries.length > 0
    ? noteEntries.map((entry) => ({
        id: entry.id,
        createdAt: entry.created_at ? new Date(entry.created_at).toLocaleString() : "",
        content: entry.content || "",
      }))
    : (lead.lead_notes || "")
        .split(/\n\s*\n(?=\[)/g)
        .map((entry: string) => entry.trim())
        .filter(Boolean)
        .reverse()
        .map((content: string, index: number) => ({ id: `legacy-${index}`, createdAt: "", content }));

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F3F4F6", color: "#111827", fontFamily: "sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto", paddingBottom: "100px" }}>
        
        {/* HEADER */}
        <div style={{ marginBottom: "30px", borderBottom: "1px solid #e5e7eb", paddingBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
             <a href="/dashboard/engine" style={{ color: "#6B7280", textDecoration: "none", marginBottom: "5px", display: "inline-block" }}>← Back to List</a>
             <h1 style={{ margin: 0, fontSize: "32px", color: "#111827" }}>{formData.company_name || "New Prospect"}</h1>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={handleDelete} disabled={isDeleting} style={{ backgroundColor: "#ef4444", color: "#fff", padding: "10px 20px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer" }}>
                {isDeleting ? "Deleting..." : "🗑️ Delete"}
            </button>
            <button onClick={() => runAction("Convert", convertLeadToDealAction.bind(null, lead.id, formData.company_name, "owner_operator"), setLoading)} style={{ backgroundColor: "#22c55e", color: "#000", padding: "10px 20px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer" }}>
                {loading ? "Converting..." : "✅ Convert to Deal"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px" }}>
          <div>
            {/* DETAILS */}
            <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "20px" }}>
              <h3 style={{ marginTop: 0, color: "#111827", marginBottom: "20px" }}>📋 Prospect Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                <div><label style={{color:"#6B7280", fontSize:"12px"}}>COMPANY</label><input name="company_name" value={formData.company_name} onChange={handleChange} onFocus={handleFocus} style={inputStyle} /></div>
                <div><label style={{color:"#6B7280", fontSize:"12px"}}>CONTACT</label><input name="contact_name" value={formData.contact_name} onChange={handleChange} onFocus={handleFocus} style={inputStyle} /></div>
                <div><label style={{color:"#6B7280", fontSize:"12px"}}>EMAIL</label><input name="email" value={formData.email} onChange={handleChange} style={inputStyle} /></div>
                <div><label style={{color:"#6B7280", fontSize:"12px"}}>PHONE</label><input name="phone" value={formData.phone} onChange={handleChange} style={inputStyle} placeholder="e.g. +1 555-012-3456" /></div>
                <div><label style={{color:"#6B7280", fontSize:"12px"}}>STATUS</label>
                  <select name="status" value={formData.status} onChange={handleChange} style={inputStyle}>
                      <option>New</option><option>Contacted</option><option>Qualified</option>
                  </select>
                </div>
                <div><label style={{color:"#6B7280", fontSize:"12px"}}>PIPELINE</label>
                  <select name="pipeline_stage" value={formData.pipeline_stage} onChange={handleChange} style={inputStyle}>
                      <option>Prospecting</option>
                      <option>Outbound</option>
                      <option>Contacted</option>
                      <option>Qualified</option>
                      <option>Proposal</option>
                      <option>Negotiation</option>
                      <option>Won</option>
                      <option>Lost</option>
                  </select>
                </div>
                <div><label style={{color:"#6B7280", fontSize:"12px"}}>CAMPAIGN</label><input name="campaign" value={formData.campaign} onChange={handleChange} style={inputStyle} placeholder="e.g. Q1 Outreach" /></div>
              </div>
              <button onClick={handleSave} style={{ backgroundColor: "#2563eb", color: "#fff", padding: "10px 20px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>{loading ? "Saving..." : "Save Changes"}</button>
            </div>

            <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "20px" }}>
              <h3 style={{ marginTop: 0, color: "#111827", marginBottom: "12px" }}>🗒️ Notes</h3>
              <textarea
                name="lead_notes"
                value={formData.lead_notes}
                onChange={handleChange}
                style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
                placeholder="Add notes about this contact..."
              />
              <div style={{ marginTop: "10px" }}>
                <button onClick={handleSaveNotes} style={{ backgroundColor: "#2563eb", color: "#fff", padding: "8px 16px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>
                  {notesSaving ? "Saving..." : "Save Notes"}
                </button>
              </div>
              {archivedNotes.length > 0 && (
                <div style={{ marginTop: "16px" }}>
                  <div style={{ fontSize: "12px", color: "#6B7280", fontWeight: 600, marginBottom: "6px" }}>Archived Notes</div>
                  {archivedNotes.map((entry, index) => (
                    <div key={entry.id || `note-${index}`} style={{ backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "10px", marginBottom: "8px", whiteSpace: "pre-wrap", fontSize: "12px", color: "#374151" }}>
                      {entry.createdAt && (
                        <div style={{ color: "#6B7280", marginBottom: "6px" }}>{entry.createdAt}</div>
                      )}
                      {editingNoteId === entry.id ? (
                        <div>
                          <textarea
                            value={editingNoteContent}
                            onChange={(e) => setEditingNoteContent(e.target.value)}
                            style={{ ...inputStyle, minHeight: "100px", resize: "vertical", fontSize: "12px" }}
                          />
                          <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                            <button
                              onClick={() => handleUpdateNoteEntry(entry.id)}
                              disabled={noteEntryBusyId === entry.id}
                              style={{ backgroundColor: "#2563eb", color: "#fff", padding: "6px 12px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
                            >
                              {noteEntryBusyId === entry.id ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={handleCancelNoteEdit}
                              style={{ backgroundColor: "#E5E7EB", color: "#111827", padding: "6px 12px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div>{entry.content}</div>
                          {!String(entry.id || "").startsWith("legacy-") && (
                            <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                              <button
                                onClick={() => handleEditNoteEntry(entry)}
                                style={{ backgroundColor: "#fff", color: "#111827", padding: "4px 10px", border: "1px solid #D1D5DB", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteNoteEntry(entry.id)}
                                disabled={noteEntryBusyId === entry.id}
                                style={{ backgroundColor: "#ef4444", color: "#fff", padding: "4px 10px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
                              >
                                {noteEntryBusyId === entry.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SCRIPT */}
            <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px" }}>
               <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                  <h3 style={{ margin: 0, color: "#111827" }}>🎙️ Tuff Love Script</h3>
                  <button onClick={handleGenerateScript} style={{ backgroundColor: "#7c3aed", color: "#fff", border: "none", padding: "5px 15px", borderRadius: "4px", cursor: "pointer" }}>{scriptLoading ? "Writing..." : "✨ Generate"}</button>
                </div>
               <textarea readOnly value={scriptText || "Click Generate..."} style={{ ...inputStyle, height: "100px", backgroundColor: "#F9FAFB" }} />
            </div>
          </div>

          <div>
            {/* RESEARCH */}
            <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px" }}>
              <h3 style={{ marginTop: 0, color: "#111827" }}>🔍 Research</h3>
              <p style={{ color: "#6B7280", fontSize: "14px" }}>Status: <span style={{ color: "#111827" }}>{lead.research_status || "Not started"}</span></p>
              {lastRun && (
                <p style={{ color: "#6B7280", fontSize: "12px", marginTop: "-6px" }}>Last run: {lastRun}</p>
              )}
              {lead.research_error && lead.research_status !== "No match" && (
                <p style={{ color: "#b91c1c", fontSize: "12px" }}>{lead.research_error}</p>
              )}
              {lead.research_status === "No match" && !lead.research_error && (
                <p style={{ color: "#6B7280", fontSize: "12px" }}>No matching person found.</p>
              )}
              
              <button onClick={handleResearch} disabled={researchLoading} style={{ width: "100%", backgroundColor: researchLoading ? "#93c5fd" : "#3b82f6", color: "#fff", padding: "12px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                {researchLoading ? "Searching..." : "Dig Deep 🔍"}
              </button>
              {researchMessage && (
                <p style={{ color: "#065f46", fontSize: "12px", marginTop: "8px" }}>{researchMessage}</p>
              )}

              {showResearchResults && (
                <div style={{ marginTop: "20px", fontSize: "13px", color: "#374151" }}>
                    <div style={{ marginBottom: "8px" }}>✅ <strong>Email:</strong> {displayEmail}</div>
                    <div style={{ marginBottom: "8px" }}>✅ <strong>Phone:</strong> {displayPhone}</div>
                    <div>🔗 <a href={displayLinkedIn} target="_blank" style={{ color: "#2563eb" }}>LinkedIn Profile</a></div>
                </div>
              )}
              {savedSnapshot && (
                <div style={{ marginTop: "16px", fontSize: "12px", color: "#374151" }}>
                  <div style={{ fontWeight: 600, marginBottom: "6px" }}>Saved Searches{savedSearchTime ? ` · ${savedSearchTime}` : ""}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {savedQuickLinks.google && (
                      <a href={savedQuickLinks.google} target="_blank" style={{ color: "#2563eb" }}>Google</a>
                    )}
                    {savedQuickLinks.linkedin && (
                      <a href={savedQuickLinks.linkedin} target="_blank" style={{ color: "#2563eb" }}>LinkedIn</a>
                    )}
                    {savedQuickLinks.facebook && (
                      <a href={savedQuickLinks.facebook} target="_blank" style={{ color: "#2563eb" }}>Facebook</a>
                    )}
                  </div>
                </div>
              )}
              {recentVerifications.length > 0 && (
                <div style={{ marginTop: "18px", fontSize: "12px", color: "#374151" }}>
                      <div style={{ fontWeight: 600, marginBottom: "8px" }}>Verification Evidence</div>
                  {recentVerifications.map((item) => {
                    const results = Array.isArray(item?.evidence?.results) ? item.evidence.results.slice(0, 3) : [];
                    const match = item?.evidence?.match || null;
                    const createdAt = item?.created_at ? new Date(item.created_at).toLocaleString() : "";
                    const providerLabel = "BeTeachable Business Assistant People Search";
                    const providerSource =
                      String(item?.provider || "").toLowerCase() === "serpapi" ? "Web" : "Core";
                    return (
                      <div key={item.id} style={{ padding: "10px", border: "1px solid #E5E7EB", borderRadius: "8px", marginBottom: "10px", backgroundColor: "#F9FAFB" }}>
                        <div style={{ fontWeight: 600 }}>
                          {providerLabel} · {providerSource} · {item.status || "Unknown"}
                          {typeof item.confidence === "number" && (
                            <span style={{ color: "#6B7280", fontWeight: 500 }}> · {item.confidence}%</span>
                          )}
                        </div>
                        {createdAt && (
                          <div style={{ color: "#6B7280", marginTop: "4px" }}>
                            Searched: {createdAt}
                          </div>
                        )}
                        {Array.isArray(item?.matched_fields) && item.matched_fields.length > 0 && (
                          <div style={{ color: "#6B7280", marginTop: "4px" }}>
                            Matched: {item.matched_fields.join(", ")}
                          </div>
                        )}
                        {match && (
                          <div style={{ color: "#6B7280", marginTop: "4px" }}>
                            {match.name ? `Name: ${match.name}` : null}
                            {match.company ? ` · Company: ${match.company}` : null}
                          </div>
                        )}
                        {results.length > 0 && (
                          <div style={{ marginTop: "6px" }}>
                            {results.map((result, index) => {
                              if (!result?.link) return null;
                              return (
                                <div key={`${item.id}-result-${index}`} style={{ marginBottom: "4px" }}>
                                  <a href={result.link} target="_blank" style={{ color: "#2563eb" }}>
                                    {result.title || result.link}
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {encodedQuery && (
                <div style={{ marginTop: "18px", fontSize: "12px", color: "#6B7280" }}>
                  <div style={{ fontWeight: "600", marginBottom: "6px" }}>Quick Searches</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <a href={`https://www.google.com/search?q=${encodedQuery}`} target="_blank" style={{ color: "#2563eb" }}>Google</a>
                    <a href={`https://www.linkedin.com/search/results/all/?keywords=${encodedQuery}`} target="_blank" style={{ color: "#2563eb" }}>LinkedIn</a>
                    <a href={`https://www.facebook.com/search/top?q=${encodedQuery}`} target="_blank" style={{ color: "#2563eb" }}>Facebook</a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
