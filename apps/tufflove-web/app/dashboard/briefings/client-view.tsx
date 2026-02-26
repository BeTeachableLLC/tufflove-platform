"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateMeetingAction, deleteMeetingAction, createMeetingAction, chatWithMeetingAIAction, saveChatToMeetingAction, getAssistantSessionsAction, getMeetingStorageStatusAction, uploadMeetingDocumentAction, getMeetingDocumentsAction, deleteMeetingDocumentAction } from "@/app/actions";
import { Trash2, Edit2, Plus, Bot, ChevronLeft, Calendar, FileCheck, LogOut } from "lucide-react";
import { formatMissingFields } from "@/lib/dna";

type ChatMessage = { role: "user" | "ai"; text: string };
type AssistantSession = { id: string; content: string; created_at?: string };
type MeetingDocument = {
  id: string;
  file_name: string;
  file_path: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  notes?: string | null;
  text_content?: string | null;
  created_at?: string;
  url?: string | null;
};

type Meeting = {
  id: string;
  title?: string | null;
  summary?: string | null;
  meeting_notes?: string | null;
  assistant_notes?: string | null;
  date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MeetingDetailViewProps = {
  meeting: Meeting;
  onBack: () => void;
  onChatSaved: (id: string, newAssistantNotes?: string) => void;
};

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Unknown error";

const CHAT_SESSION_HEADER_REGEX = /^\s*--- (?:🧠 COACHING SESSION|ASSISTANT NOTES) ---\s*$/gm;
const CHAT_SESSION_FOOTER_REGEX = /--- END SESSION ---\s*/g;
const CHAT_SESSION_BLOCK_REGEX =
  /--- (?:🧠 COACHING SESSION|ASSISTANT NOTES) ---[\s\S]*?--- END SESSION ---/g;

function cleanChatText(text: string) {
  let output = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  output = output.replace(/```[a-zA-Z0-9]*\n([\s\S]*?)```/g, "$1");
  output = output.replace(/```([\s\S]*?)```/g, "$1");
  output = output.replace(/`([^`]+)`/g, "$1");
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  output = output.replace(/(^|\n)#{1,6}\s+/g, "$1");
  output = output.replace(/(^|\n)>\s?/g, "$1");
  output = output.replace(/(^|\n)\s*\*\s*(?=\S)/g, "$1- ");
  output = output.replace(/\*\*(.*?)\*\*/g, "$1");
  output = output.replace(/__(.*?)__/g, "$1");
  output = output.replace(/\*(\S[\s\S]*?\S)\*/g, "$1");
  output = output.replace(/_(\S[\s\S]*?\S)_/g, "$1");
  output = output.replace(/[*_]+/g, "");
  output = output.replace(/[ \t]+\n/g, "\n");
  return output.trim();
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatParagraphs(text: string) {
  const lines = text.split("\n");
  const htmlParts: string[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const content = escapeHtml(paragraphLines.join("\n")).replace(/\n/g, "<br/>");
    htmlParts.push(`<p>${content}</p>`);
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0 || !listType) return;
    htmlParts.push(`<${listType}>${listItems.join("")}</${listType}>`);
    listItems = [];
    listType = null;
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)/);
    const numberMatch = line.match(/^\d+\.\s+(.*)/);

    if (bulletMatch) {
      flushParagraph();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(`<li>${escapeHtml(bulletMatch[1])}</li>`);
      return;
    }

    if (numberMatch) {
      flushParagraph();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(`<li>${escapeHtml(numberMatch[1])}</li>`);
      return;
    }

    flushList();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushList();

  return htmlParts.join("");
}

const FormattedText = ({
  content,
  emptyText,
  tone,
}: {
  content: string;
  emptyText?: string;
  tone?: "light" | "dark";
}) => {
  const cleaned = cleanChatText(content || "");
  const html = cleaned ? formatParagraphs(cleaned) : `<p>${escapeHtml(emptyText || "No content yet.")}</p>`;
  return (
    <div
      style={{ lineHeight: "1.7", fontSize: "14px", color: tone === "dark" ? "#FFFFFF" : "#374151" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

function extractChatBlocks(summary: string) {
  if (!summary) return [];
  const matches = [...summary.matchAll(CHAT_SESSION_HEADER_REGEX)];
  if (matches.length === 0) return [];

  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? summary.length;
      return summary.slice(start, end).replace(CHAT_SESSION_FOOTER_REGEX, "").trim();
    })
    .filter((block) => block.length > 0);
}

function parseChatMessagesFromBlock(block: string): ChatMessage[] {
  const matches = [
    ...block.matchAll(/\*\*(YOU|BETEACHABLE):\*\*|(?:^|\n)(YOU|BETEACHABLE):/g),
  ];
  if (matches.length === 0) return [];

  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? block.length;
      const text = cleanChatText(block.slice(start, end).trim());
      const roleLabel = match[1] || match[2];
      const role = roleLabel === "YOU" ? "user" : "ai";
      return text ? { role, text } : null;
    })
    .filter((msg): msg is ChatMessage => Boolean(msg));
}

function parseChatHistoryFromSummary(summary: string): ChatMessage[] {
  return extractChatBlocks(summary).flatMap(parseChatMessagesFromBlock);
}

function extractChatBlocksRaw(summary: string) {
  if (!summary) return "";
  const matches = summary.match(CHAT_SESSION_BLOCK_REGEX);
  return matches ? matches.join("\n\n").trim() : "";
}

function formatChatTranscript(messages: ChatMessage[]) {
  return messages
    .map((msg) => `${msg.role === "user" ? "YOU" : "BETEACHABLE"}: ${cleanChatText(msg.text)}`)
    .join("\n\n");
}

function getMeetingNotes(meeting: Meeting) {
  return (meeting?.meeting_notes || meeting?.summary || "").toString();
}

function getAssistantNotesRaw(meeting: Meeting) {
  const assistantNotes = (meeting?.assistant_notes || "").toString();
  if (assistantNotes.trim()) return assistantNotes;
  return extractChatBlocksRaw(meeting?.summary || "");
}

function getMeetingPreview(meeting: Meeting) {
  const notes = getMeetingNotes(meeting);
  const preview = cleanChatText(notes);
  return preview || "No notes yet.";
}

function getMeetingSearchText(meeting: Meeting) {
  const title = meeting?.title || "";
  const notes = getMeetingNotes(meeting);
  const assistantNotes = getAssistantNotesRaw(meeting);
  const chat = parseChatHistoryFromSummary(assistantNotes)
    .map((msg) => msg.text)
    .join(" ");
  return cleanChatText(`${title} ${notes} ${assistantNotes} ${chat}`).toLowerCase();
}

function formatBytes(value?: number | null) {
  if (!value || Number.isNaN(value)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function buildDocumentContext(documents: MeetingDocument[]) {
  const lines: string[] = [];
  documents.forEach((doc) => {
    const meta = [
      doc.mime_type ? doc.mime_type : "file",
      doc.size_bytes ? formatBytes(doc.size_bytes) : null,
    ].filter(Boolean).join(", ");
    const header = `- ${doc.file_name}${meta ? ` (${meta})` : ""}`;
    lines.push(header);
    if (doc.notes) lines.push(`  Notes: ${cleanChatText(doc.notes)}`);
    if (doc.text_content) {
      const snippet = cleanChatText(doc.text_content).slice(0, 1200);
      if (snippet) lines.push(`  Content snippet: ${snippet}`);
    }
  });
  const combined = lines.join("\n");
  return combined.slice(0, 4000);
}

function buildWordHtml({
  title,
  notes,
  chat,
}: {
  title: string;
  notes: string;
  chat: ChatMessage[];
}) {
  const cleanedNotes = cleanChatText(notes);
  const notesHtml = cleanedNotes ? formatParagraphs(cleanedNotes) : "<p>No notes yet.</p>";
  const chatHtml = chat.length
    ? chat
        .map((msg) => {
          const label = msg.role === "user" ? "YOU" : "BETEACHABLE";
          const body = cleanChatText(msg.text);
          const bodyHtml = escapeHtml(body).replace(/\n/g, "<br/>");
          return `<p><strong>${label}:</strong> ${bodyHtml}</p>`;
        })
        .join("")
    : "<p>No chat yet.</p>";

  const safeTitle = escapeHtml(title || "Meeting Notes");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.6; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      h2 { font-size: 16px; margin-top: 24px; }
      p { margin: 8px 0; }
      ul, ol { margin: 8px 0 8px 18px; }
    </style>
  </head>
  <body>
    <h1>${safeTitle}</h1>
    <h2>Meeting Notes</h2>
    ${notesHtml}
    <h2>Coaching Chat</h2>
    ${chatHtml}
  </body>
</html>`;
}

function slugifyFilename(value: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .trim();
  return base || "meeting-notes";
}

function downloadWordDoc(html: string, filename: string) {
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugifyFilename(filename)}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function MeetingManager({
  meetings,
  initialSelectedId,
  missingDnaFields,
}: {
  meetings: Meeting[];
  initialSelectedId?: string | null;
  missingDnaFields?: string[];
}) {
  const router = useRouter();
  const [meetingList, setMeetingList] = useState(meetings);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(initialSelectedId || null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => { setMeetingList(meetings); }, [meetings]);
  useEffect(() => {
    if (initialSelectedId) {
      setSelectedMeetingId(initialSelectedId);
    }
  }, [initialSelectedId]);
  useEffect(() => {
    if (selectedMeetingId && !meetingList.find((m) => m.id === selectedMeetingId)) {
      setSelectedMeetingId(null);
    }
  }, [meetingList, selectedMeetingId]);

  const handleCreate = async () => {
    setLoading(true);
    await createMeetingAction();
    setLoading(false);
  };

  // *** FIXED DELETE ***
  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation(); 
    if (!confirm("PERMANENTLY DELETE this meeting?")) return;
    
    const previousMeetings = meetingList;
    setMeetingList((prev) => prev.filter((m) => m.id !== id));
    if (selectedMeetingId === id) setSelectedMeetingId(null);

    try {
        await deleteMeetingAction(id);
        router.refresh();
    } catch (err: unknown) {
        console.error("Delete failed:", err);
        setMeetingList(previousMeetings);
        alert(getErrorMessage(err) || "Delete failed. Please try again.");
        router.refresh();
    }
  };

  const handleChatSaved = (id: string, newAssistantNotes?: string) => {
    if (newAssistantNotes) {
      setMeetingList(prev => prev.map(m => m.id === id ? { ...m, assistant_notes: newAssistantNotes } : m));
    }
    router.refresh();
  };

  const activeMeeting = meetingList.find(m => m.id === selectedMeetingId);
  const filteredMeetings = meetingList.filter((meeting) => {
    if (!searchTerm.trim()) return true;
    return getMeetingSearchText(meeting).includes(searchTerm.trim().toLowerCase());
  });

  return (
    <div style={{ padding: "40px", backgroundColor: "#F3F4F6", minHeight: "100vh", color: "#111827" }}>
      {missingDnaFields && missingDnaFields.length > 0 && (
        <div
          style={{
            backgroundColor: "#FEF3C7",
            border: "1px solid #FDE68A",
            color: "#92400E",
            padding: "12px 16px",
            borderRadius: "12px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            fontSize: "13px",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, marginBottom: "4px" }}>Complete your DNA</div>
            <div>Missing: {formatMissingFields(missingDnaFields).join(", ")}.</div>
          </div>
          <Link
            href="/dashboard/the-code"
            style={{
              color: "#92400E",
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Complete DNA →
          </Link>
        </div>
      )}
      
      {/* HEADER */}
      {!activeMeeting && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <div>
            <h1 style={{ fontSize: "32px", fontWeight: "800", marginBottom: "8px", color: "#111827" }}>Meeting Intelligence</h1>
            <p style={{ color: "#6B7280" }}>Transcripts, AI Insights, and Action Items.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search notes or chat..."
              style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #E5E7EB", minWidth: "240px" }}
            />
            <button onClick={handleCreate} disabled={loading} style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#111827", color: "#fff", padding: "10px 20px", borderRadius: "8px", fontWeight: "600", border: "none", cursor: "pointer" }}>
              {loading ? "Creating..." : <><Plus size={18} /> New Meeting</>}
            </button>
          </div>
        </div>
      )}

      {/* VIEW SWITCHER */}
      {activeMeeting ? (
        <MeetingDetailView 
            meeting={activeMeeting} 
            onBack={() => setSelectedMeetingId(null)}
            onChatSaved={handleChatSaved}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
          {filteredMeetings.length === 0 ? (
            <div style={{ textAlign: "center", color: "#9CA3AF", padding: "40px", gridColumn: "1/-1" }}>No meetings found. Start a new one!</div>
          ) : (
            filteredMeetings.map((meeting) => (
              <div key={meeting.id} onClick={() => setSelectedMeetingId(meeting.id)} style={{ backgroundColor: "#FFFFFF", padding: "24px", borderRadius: "12px", border: "1px solid #E5E7EB", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)", cursor: "pointer", transition: "all 0.2s", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontSize: "12px", color: "#6B7280", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Calendar size={12} /> {meeting.created_at ? new Date(meeting.created_at).toLocaleDateString() : "—"}
                    </span>
                    <button onClick={(e) => handleDelete(e, meeting.id)} title="Delete Meeting" style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: "4px" }}><Trash2 size={16} /></button>
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: "bold", color: "#111827", marginBottom: "8px" }}>{meeting.title}</h3>
                <p style={{ color: "#6B7280", fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {getMeetingPreview(meeting)}
                </p>
                <div style={{ marginTop: "15px", color: "#2563eb", fontSize: "13px", fontWeight: "600" }}>Open Notes →</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MeetingDetailView({ meeting, onBack, onChatSaved }: MeetingDetailViewProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const meetingNotes = getMeetingNotes(meeting);
  const assistantNotesRaw = getAssistantNotesRaw(meeting);
  const [quickNotes, setQuickNotes] = useState(meetingNotes);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState<number | null>(null);
  const [documents, setDocuments] = useState<MeetingDocument[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentNotes, setDocumentNotes] = useState("");
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [documentUploading, setDocumentUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [storageStatus, setStorageStatus] = useState<null | {
    notesColumns: boolean;
    sessionsTable: boolean;
    notesAccessDenied: boolean;
    sessionsAccessDenied: boolean;
    documentsTable: boolean;
    documentsAccessDenied: boolean;
    documentsBucket: boolean;
    documentsBucketAccessDenied: boolean;
  }>(null);
  const [assistantSessions, setAssistantSessions] = useState<AssistantSession[]>([]);
  const [assistantNotesFallback, setAssistantNotesFallback] = useState(assistantNotesRaw);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const sessionStartIndexRef = useRef(0);
  const [aiLoading, setAiLoading] = useState(false);
  const notesForExport = meetingNotes;
  const fallbackBlocks = extractChatBlocks(assistantNotesFallback);
  const fallbackChatHistory = fallbackBlocks.flatMap(parseChatMessagesFromBlock);
  const sessionBlockSet = new Set(assistantSessions.map((session) => cleanChatText(session.content)));
  const sessionChatHistory = assistantSessions.flatMap((session) => parseChatMessagesFromBlock(session.content));
  const persistedChatHistory = assistantSessions.length
    ? [
        ...fallbackBlocks
          .filter((block) => !sessionBlockSet.has(cleanChatText(block)))
          .flatMap(parseChatMessagesFromBlock),
        ...sessionChatHistory,
      ]
    : fallbackChatHistory;
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  useEffect(() => {
    let isActive = true;
    const loadSessions = async () => {
      setIsLoadingSessions(true);
      try {
        const result = await getAssistantSessionsAction(meeting.id);
        if (!isActive) return;
        if (result?.type === "sessions") {
          setAssistantSessions(result.sessions || []);
          setAssistantNotesFallback(assistantNotesRaw);
        } else if (result?.type === "notes") {
          const notes = (result.notes || "").toString();
          setAssistantNotesFallback(notes);
          setAssistantSessions([]);
        }
      } catch {
        if (isActive) {
          setAssistantSessions([]);
          setAssistantNotesFallback(assistantNotesRaw);
        }
      } finally {
        if (isActive) setIsLoadingSessions(false);
      }
    };
    loadSessions();
    return () => {
      isActive = false;
    };
  }, [meeting.id, assistantNotesRaw]);

  useEffect(() => {
    let isActive = true;
    const loadDocuments = async () => {
      try {
        const result = await getMeetingDocumentsAction(meeting.id);
        if (isActive) setDocuments(result || []);
      } catch {
        if (isActive) setDocuments([]);
      }
    };
    loadDocuments();
    return () => {
      isActive = false;
    };
  }, [meeting.id]);

  useEffect(() => {
    setQuickNotes(meetingNotes);
  }, [meetingNotes]);

  useEffect(() => {
    let isActive = true;
    const loadStorageStatus = async () => {
      try {
        const result = await getMeetingStorageStatusAction();
        if (isActive) setStorageStatus(result || null);
      } catch {
        if (isActive) setStorageStatus(null);
      }
    };
    loadStorageStatus();
    return () => {
      isActive = false;
    };
  }, []);

  // -- SAVE & EXIT (Debugged) --
  const saveCurrentSession = async (exitAfterSave: boolean) => {
    const newMessages = chatHistory.slice(sessionStartIndexRef.current);
    if (newMessages.length === 0) {
      if (exitAfterSave) onBack();
      return;
    }

    setIsSavingSession(true);
    try {
      const transcript = formatChatTranscript(newMessages);
      const result = await saveChatToMeetingAction(meeting.id, transcript);

      if (result?.type === "session") {
        const nextSession = result.session as AssistantSession;
        setAssistantSessions((prev) => [...prev, nextSession]);
        if (result.notes) onChatSaved(meeting.id, result.notes);
        else onChatSaved(meeting.id);
      } else if (result?.type === "notes") {
        const notes = (result.notes || "").toString();
        setAssistantNotesFallback(notes);
        setAssistantSessions([]);
        onChatSaved(meeting.id, notes);
      } else {
        alert("Error: Save failed (No data returned).");
        return;
      }
      sessionStartIndexRef.current = chatHistory.length;
      alert("✅ Assistant notes saved.");
      if (exitAfterSave) onBack();
    } catch (err: unknown) {
      alert("Save Failed: " + getErrorMessage(err));
    } finally {
      setIsSavingSession(false);
    }
  };

  const handleSaveAndExit = async () => {
    await saveCurrentSession(true);
  };

  const handleSaveSession = async () => {
    await saveCurrentSession(false);
  };

  const handleDiscardAndExit = () => {
    if (chatHistory.length > 0) {
        if (!confirm("⚠️ Discard this chat session?")) return;
    }
    onBack();
  };

  const handleSaveNotes = async (formData: FormData) => {
    const title = (formData.get("title") as string) || "";
    const notes = (formData.get("meeting_notes") as string) || "";
    const cleanedNotes = cleanChatText(notes);
    const nextFormData = new FormData();
    nextFormData.set("title", title);
    nextFormData.set("meeting_notes", cleanedNotes);
    await updateMeetingAction(meeting.id, nextFormData);
    setIsEditing(false);
    router.refresh();
  };

  const handleQuickSaveNotes = async () => {
    if (notesSaving) return;
    setNotesSaving(true);
    try {
      const cleanedNotes = cleanChatText(quickNotes || "");
      const nextFormData = new FormData();
      nextFormData.set("title", meeting.title || "");
      nextFormData.set("meeting_notes", cleanedNotes);
      await updateMeetingAction(meeting.id, nextFormData);
      setNotesSavedAt(Date.now());
      router.refresh();
    } catch (err: unknown) {
      alert("Notes save failed: " + getErrorMessage(err));
    } finally {
      setNotesSaving(false);
    }
  };

  const handleUploadDocuments = async () => {
    if (documentUploading || selectedFiles.length === 0) return;
    setDocumentUploading(true);
    setDocumentError(null);
    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        if (documentNotes) formData.append("notes", documentNotes);
        await uploadMeetingDocumentAction(meeting.id, formData);
      }
      const refreshed = await getMeetingDocumentsAction(meeting.id);
      setDocuments(refreshed || []);
      setSelectedFiles([]);
      setDocumentNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      setDocumentError(getErrorMessage(err) || "Upload failed.");
    } finally {
      setDocumentUploading(false);
    }
  };

  const handleDeleteDocument = async (doc: MeetingDocument) => {
    if (!confirm(`Delete "${doc.file_name}"?`)) return;
    try {
      await deleteMeetingDocumentAction(doc.id, doc.file_path);
      setDocuments((prev) => prev.filter((item) => item.id !== doc.id));
    } catch (err: unknown) {
      alert("Delete failed: " + getErrorMessage(err));
    }
  };

  const handleDownloadDoc = () => {
    const unsavedChat = chatHistory.slice(sessionStartIndexRef.current);
    const chatForExport = [...persistedChatHistory, ...unsavedChat];
    const html = buildWordHtml({
      title: meeting.title || "Meeting Notes",
      notes: notesForExport,
      chat: chatForExport,
    });
    downloadWordDoc(html, meeting.title || "meeting-notes");
  };

  const handleAIChat = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(!chatInput.trim()) return;
    const userMsg = chatInput;
    const nextHistory: ChatMessage[] = [...chatHistory, { role: "user", text: userMsg }];
    setChatHistory(nextHistory);
    setChatInput("");
    setAiLoading(true);
    
    try {
        const recentChat = nextHistory.slice(sessionStartIndexRef.current).slice(-12);
        const persistedContext = persistedChatHistory.slice(-12);
        const combinedContext = [...persistedContext, ...recentChat].slice(-20);
        const chatContext = combinedContext.length ? formatChatTranscript(combinedContext) : "";
        const documentContext = buildDocumentContext(documents);
        const aiResponse = await chatWithMeetingAIAction(meetingNotes || "", userMsg, chatContext, documentContext);
        const cleanedResponse = cleanChatText(aiResponse || "");
        setChatHistory((prev) => [...prev, { role: "ai", text: cleanedResponse }]);
    } catch (err: unknown) {
        setChatHistory((prev) => [...prev, { role: "ai", text: "App Error: " + getErrorMessage(err) }]);
    } finally {
        setAiLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "24px" }}>
        
        {/* NAV BAR */}
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <button onClick={handleDiscardAndExit} style={{ display: "flex", alignItems: "center", gap: "5px", color: "#6B7280", background: "none", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>
                <ChevronLeft size={16} /> Back to Meetings
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {(() => {
                const blocked = storageStatus?.notesAccessDenied || storageStatus?.sessionsAccessDenied || storageStatus?.documentsAccessDenied || storageStatus?.documentsBucketAccessDenied;
                const ready = storageStatus?.notesColumns && storageStatus?.sessionsTable && storageStatus?.documentsTable && storageStatus?.documentsBucket;
                const label = storageStatus
                  ? blocked
                    ? "Storage: Access Blocked"
                    : ready
                      ? "Storage: Ready"
                      : "Storage: Missing"
                  : "Storage: Checking...";
                const bg = storageStatus
                  ? blocked
                    ? "#FEF2F2"
                    : ready
                      ? "#ECFDF5"
                      : "#FFFBEB"
                  : "#F3F4F6";
                const fg = storageStatus
                  ? blocked
                    ? "#B91C1C"
                    : ready
                      ? "#059669"
                      : "#B45309"
                  : "#6B7280";
                const notesStatus = storageStatus
                  ? storageStatus.notesAccessDenied
                    ? "No access"
                    : storageStatus.notesColumns
                      ? "OK"
                      : "Missing"
                  : "Checking";
                const sessionsStatus = storageStatus
                  ? storageStatus.sessionsAccessDenied
                    ? "No access"
                    : storageStatus.sessionsTable
                      ? "OK"
                      : "Missing"
                  : "Checking";
                const documentsStatus = storageStatus
                  ? storageStatus.documentsAccessDenied
                    ? "No access"
                    : storageStatus.documentsTable
                      ? "OK"
                      : "Missing"
                  : "Checking";
                const bucketStatus = storageStatus
                  ? storageStatus.documentsBucketAccessDenied
                    ? "No access"
                    : storageStatus.documentsBucket
                      ? "OK"
                      : "Missing"
                  : "Checking";
                const title = `Notes fields: ${notesStatus} • Sessions table: ${sessionsStatus} • Documents table: ${documentsStatus} • Documents bucket: ${bucketStatus}`;

                return (
                  <div title={title} style={{ backgroundColor: bg, color: fg, padding: "6px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "700", border: "1px solid #E5E7EB" }}>
                    {label}
                  </div>
                );
              })()}
              <div style={{ backgroundColor: "#F3F4F6", color: "#6B7280", padding: "6px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "700", border: "1px solid #E5E7EB" }}>
                UI: Notes v2
              </div>
            </div>
        </div>

        {/* LEFT: EDITOR */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", padding: "30px", border: "1px solid #E5E7EB", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
            {isEditing ? (
                <form action={handleSaveNotes}>
                    <input name="title" defaultValue={meeting.title ?? ""} style={{ width: "100%", padding: "10px", marginBottom: "15px", borderRadius: "6px", border: "1px solid #D1D5DB", fontSize: "20px", fontWeight: "bold" }} />
                    <textarea name="meeting_notes" defaultValue={meetingNotes} style={{ width: "100%", height: "400px", padding: "15px", borderRadius: "6px", border: "1px solid #D1D5DB", fontFamily: "sans-serif", lineHeight: "1.6", fontSize: "15px" }} />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                        <button type="button" onClick={() => setIsEditing(false)} style={{ padding: "10px 20px", borderRadius: "6px", backgroundColor: "#F3F4F6", border: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
                        <button type="submit" style={{ padding: "10px 20px", borderRadius: "6px", backgroundColor: "#2563eb", color: "#fff", border: "none", cursor: "pointer", fontWeight: "600" }}>Save Notes</button>
                    </div>
                </form>
            ) : (
                <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                        <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#111827", margin: 0 }}>{meeting.title}</h1>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button onClick={handleDownloadDoc} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", borderRadius: "6px", backgroundColor: "#111827", color: "#fff", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                              Download Word
                            </button>
                            <button onClick={() => setIsEditing(true)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", borderRadius: "6px", backgroundColor: "#E5E7EB", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}><Edit2 size={14} /> Edit</button>
                        </div>
                    </div>
                    <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "20px" }}>
                        <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#111827", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Meeting Notes
                        </h3>
                        <FormattedText content={meetingNotes} emptyText="No meeting notes yet." />
                    </div>
                    <div style={{ marginTop: "24px", borderTop: "1px solid #F3F4F6", paddingTop: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                          <h3 style={{ margin: 0, fontSize: "14px", color: "#111827", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Additional Notes
                          </h3>
                          {notesSavedAt ? (
                            <span style={{ fontSize: "11px", color: "#10B981", fontWeight: "600" }}>
                              Saved just now
                            </span>
                          ) : null}
                        </div>
                        <textarea
                          value={quickNotes}
                          onChange={(e) => setQuickNotes(e.target.value)}
                          placeholder="Add or update meeting notes here..."
                          style={{ width: "100%", minHeight: "140px", padding: "12px", borderRadius: "8px", border: "1px solid #D1D5DB", fontFamily: "sans-serif", lineHeight: "1.6", fontSize: "14px", resize: "vertical" }}
                        />
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                          <button
                            type="button"
                            onClick={handleQuickSaveNotes}
                            disabled={notesSaving}
                            style={{ padding: "8px 14px", borderRadius: "6px", backgroundColor: "#2563eb", color: "#fff", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "13px", opacity: notesSaving ? 0.7 : 1 }}
                          >
                            {notesSaving ? "Saving..." : "Save Notes"}
                          </button>
                        </div>
                    </div>
                    <div style={{ marginTop: "24px", borderTop: "1px solid #F3F4F6", paddingTop: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                          <h3 style={{ margin: 0, fontSize: "14px", color: "#111827", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Attachments
                          </h3>
                          <span style={{ fontSize: "11px", color: "#6B7280" }}>
                            Upload files for coaching context.
                          </span>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                          style={{ width: "100%", marginBottom: "10px" }}
                        />
                        <textarea
                          value={documentNotes}
                          onChange={(e) => setDocumentNotes(e.target.value)}
                          placeholder="Optional notes about these files (what to review, key questions, etc.)"
                          style={{ width: "100%", minHeight: "80px", padding: "10px", borderRadius: "8px", border: "1px solid #D1D5DB", fontFamily: "sans-serif", fontSize: "13px", resize: "vertical", marginBottom: "10px" }}
                        />
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ fontSize: "12px", color: "#6B7280" }}>
                            {selectedFiles.length > 0 ? `${selectedFiles.length} file(s) ready to upload` : "No files selected"}
                          </div>
                          <button
                            type="button"
                            onClick={handleUploadDocuments}
                            disabled={documentUploading || selectedFiles.length === 0}
                            style={{ padding: "8px 14px", borderRadius: "6px", backgroundColor: "#111827", color: "#fff", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "13px", opacity: documentUploading || selectedFiles.length === 0 ? 0.6 : 1 }}
                          >
                            {documentUploading ? "Uploading..." : "Upload Files"}
                          </button>
                        </div>
                        {documentError ? (
                          <div style={{ marginTop: "8px", fontSize: "12px", color: "#B91C1C" }}>{documentError}</div>
                        ) : null}
                        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                          {documents.length === 0 ? (
                            <div style={{ fontSize: "12px", color: "#9CA3AF" }}>No attachments yet.</div>
                          ) : (
                            documents.map((doc) => (
                              <div key={doc.id} style={{ border: "1px solid #E5E7EB", borderRadius: "8px", padding: "10px", backgroundColor: "#F9FAFB" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                                  <div>
                                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{doc.file_name}</div>
                                    <div style={{ fontSize: "11px", color: "#6B7280" }}>
                                      {[doc.mime_type || "file", formatBytes(doc.size_bytes)].filter(Boolean).join(" • ")}
                                    </div>
                                    {doc.notes ? (
                                      <div style={{ marginTop: "6px", fontSize: "12px", color: "#374151" }}>
                                        {cleanChatText(doc.notes)}
                                      </div>
                                    ) : null}
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                                    {doc.url ? (
                                      <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "#2563eb", fontWeight: "600" }}>
                                        Download
                                      </a>
                                    ) : (
                                      <span style={{ fontSize: "12px", color: "#9CA3AF" }}>No link</span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteDocument(doc)}
                                      style={{ background: "none", border: "none", color: "#EF4444", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                    </div>
                    <div style={{ marginTop: "24px" }}>
                        <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#111827", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Assistant Notes
                        </h3>
                        <div style={{ fontSize: "12px", color: "#6B7280", marginBottom: "10px" }}>
                          Saved BeTeachable sessions for this meeting.
                        </div>
                        {isLoadingSessions ? (
                          <div style={{ fontSize: "13px", color: "#9CA3AF" }}>Loading saved chat...</div>
                        ) : persistedChatHistory.length === 0 ? (
                          <div style={{ fontSize: "13px", color: "#9CA3AF" }}>No saved chat yet.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {persistedChatHistory.map((msg, idx) => (
                              <div key={`saved-chat-${idx}`} style={{ backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "11px", fontWeight: "700", color: "#6B7280", marginBottom: "6px" }}>
                                  {msg.role === "user" ? "YOU" : "BETEACHABLE"}
                                </div>
                                <FormattedText content={msg.text} />
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                </>
            )}
        </div>

        {/* RIGHT: AI COACH */}
        <div style={{ backgroundColor: "#F9FAFB", borderRadius: "12px", border: "1px solid #E5E7EB", padding: "24px", display: "flex", flexDirection: "column", height: "600px" }}>
            
            {/* AI HEADER With Exit Options */}
            <div style={{ marginBottom: "20px", borderBottom: "1px solid #E5E7EB", paddingBottom: "15px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
                    <div style={{ width: "32px", height: "32px", backgroundColor: "#EDE9FE", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}><Bot size={18} color="#7c3aed" /></div>
                    <div><h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold", color: "#111827" }}>BeTeachable Assistant</h3><span style={{ fontSize: "12px", color: "#6B7280" }}>Powered by Tuff Love™</span></div>
                </div>
                
                <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={handleSaveAndExit} disabled={isSavingSession} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", backgroundColor: "#10B981", color: "white", border: "none", padding: "8px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "12px", opacity: isSavingSession ? 0.7 : 1 }}>
                        <FileCheck size={14} /> Save & Exit
                    </button>
                    <button onClick={handleDiscardAndExit} disabled={isSavingSession} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", backgroundColor: "#EF4444", color: "white", border: "none", padding: "8px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "12px", opacity: isSavingSession ? 0.7 : 1 }}>
                        <LogOut size={14} /> Discard & Exit
                    </button>
                </div>
                <button onClick={handleSaveSession} disabled={isSavingSession} style={{ marginTop: "10px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", backgroundColor: "#111827", color: "white", border: "none", padding: "8px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "12px", opacity: isSavingSession ? 0.7 : 1 }}>
                    Save Current Coaching Session
                </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "15px", paddingRight: "5px" }}>
                {chatHistory.map((msg, i) => (
                    <div key={i} style={{ alignSelf: msg.role === 'user' ? "flex-end" : "flex-start", backgroundColor: msg.role === 'user' ? "#2563eb" : "#FFFFFF", color: msg.role === 'user' ? "#fff" : "#111827", padding: "12px 16px", borderRadius: "12px", maxWidth: "90%", boxShadow: msg.role === 'ai' ? "0 1px 2px rgba(0,0,0,0.05)" : "none", border: msg.role === 'ai' ? "1px solid #E5E7EB" : "none" }}>
                        <FormattedText content={msg.text} tone={msg.role === "user" ? "dark" : "light"} />
                    </div>
                ))}
                {aiLoading && (<div style={{ alignSelf: "flex-start", backgroundColor: "#FFFFFF", padding: "12px", borderRadius: "12px", fontSize: "13px", color: "#6B7280", fontStyle: "italic", border: "1px solid #E5E7EB" }}>Analyzing context...</div>)}
            </div>
            <form onSubmit={handleAIChat} style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask about this meeting..." style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #D1D5DB", outline: "none", fontSize: "14px" }} />
                <button type="submit" disabled={aiLoading} style={{ backgroundColor: "#7c3aed", color: "#fff", border: "none", padding: "0 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>Send</button>
            </form>
            <div style={{ marginTop: "16px", borderTop: "1px solid #E5E7EB", paddingTop: "12px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#111827", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                    Coaching Notes (Saved)
                </div>
                {isLoadingSessions ? (
                    <div style={{ fontSize: "12px", color: "#9CA3AF" }}>Loading coaching notes...</div>
                ) : persistedChatHistory.length === 0 ? (
                    <div style={{ fontSize: "12px", color: "#9CA3AF" }}>No coaching notes saved yet.</div>
                ) : (
                    <div style={{ maxHeight: "140px", overflowY: "auto", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        {persistedChatHistory.map((msg, idx) => (
                            <div key={`saved-inline-${idx}`}>
                                <div style={{ fontSize: "10px", fontWeight: "700", color: "#6B7280", marginBottom: "4px" }}>
                                    {msg.role === "user" ? "YOU" : "BETEACHABLE"}
                                </div>
                                <FormattedText content={msg.text} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
