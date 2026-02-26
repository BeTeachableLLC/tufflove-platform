"use server";
import { randomUUID } from "crypto";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PostgrestError } from "@supabase/postgrest-js";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ColumnRow = { column_name: string | null };
type MeetingNotesRow = { assistant_notes?: string | null; summary?: string | null };
type MeetingDocumentRow = {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  text_content: string | null;
  created_at: string;
};
type LeadRecord = Record<string, unknown>;
type PdlResponse = {
  error?: { message?: string | null } | null;
  message?: string | null;
  status?: number;
  id?: string | null;
  full_name?: string | null;
  email?: string | null;
  emails?: { address?: string | null }[] | null;
  phone_numbers?: { number?: string | null }[] | null;
  linkedin_url?: string | null;
  job_company_name?: string | null;
  job_title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};
type SerpResult = { title?: string | null; link?: string | null; snippet?: string | null };
type SerpResponse = {
  organic_results?: SerpResult[] | null;
  error?: string | null;
  error_message?: string | null;
};
type WebTopLink = { title: string; link: string };

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
};

const makePostgrestError = (message: string): PostgrestError =>
  new PostgrestError({
    message,
    details: "",
    hint: "",
    code: "",
  });

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

// --- HELPER ---
async function getActiveTeamId(supabase: SupabaseServerClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: member } = await supabase.from('team_members').select('team_id').eq('user_id', user.id).limit(1).single();
  if (member) return member.team_id;
  const { data: ownedTeam } = await supabase.from('teams').select('id').eq('created_by', user.id).limit(1).single();
  if (ownedTeam) return ownedTeam.id;
  throw new Error("No team found.");
}

async function getTableColumnSet(supabase: SupabaseServerClient, tableName: string) {
  try {
    const { data, error } = await supabase
      .schema("information_schema")
      .from("columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", tableName);
    if (error || !data || data.length === 0) return null;
    const columns = (data as ColumnRow[]).map((row) => row.column_name).filter((name): name is string => Boolean(name));
    return new Set(columns);
  } catch {
    return null;
  }
}

async function getLeadColumnSet(supabase: SupabaseServerClient) {
  return getTableColumnSet(supabase, "leads");
}

async function getDealColumnSet(supabase: SupabaseServerClient) {
  return getTableColumnSet(supabase, "deals");
}

// ==========================================
// 1. MEETING ACTIONS (Reliable Delete & Save)
// ==========================================

export async function createMeetingAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const insertPayload = {
    user_id: user.id,
    title: "New Strategy Session",
    meeting_notes: "Jot down your notes here...",
    assistant_notes: "",
    summary: "Jot down your notes here...",
    date: new Date().toISOString()
  };

  const { error } = await supabase.from("meetings").insert(insertPayload);
  if (error) {
    const fallbackPayload = {
      user_id: user.id,
      title: "New Strategy Session",
      summary: "Jot down your notes here...",
      date: new Date().toISOString(),
    };
    const { error: fallbackError } = await supabase.from("meetings").insert(fallbackPayload);
    if (fallbackError) throw new Error(fallbackError.message);
  }
  revalidatePath("/dashboard/briefings");
}

export async function updateMeetingAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const title = formData.get("title") as string;
  const meetingNotes = (formData.get("meeting_notes") as string) || (formData.get("summary") as string);

  const updates: Record<string, string> = { title };
  if (typeof meetingNotes === "string") {
    updates.meeting_notes = meetingNotes;
    updates.summary = meetingNotes;
  }

  const { error } = await supabase.from("meetings").update(updates).eq("id", id);
  if (error) {
    const message = error.message || "";
    if (message.includes("meeting_notes") || message.includes("assistant_notes")) {
      const fallback = { title, summary: meetingNotes || "" };
      const { error: fallbackError } = await supabase.from("meetings").update(fallback).eq("id", id);
      if (fallbackError) throw new Error(fallbackError.message);
    } else {
      throw new Error(error.message);
    }
  }
  revalidatePath("/dashboard/briefings");
}

// *** FIXED: Returns new summary for instant UI update ***
export async function saveChatToMeetingAction(id: string, chatLog: string) {
  const supabase = await createClient();

  const cleanedChatLog = chatLog
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/```[a-zA-Z0-9]*\n([\s\S]*?)```/g, "$1")
    .replace(/```([\s\S]*?)```/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/(^|\n)#{1,6}\s+/g, "$1")
    .replace(/(^|\n)>\s?/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(\S[\s\S]*?\S)\*/g, "$1")
    .replace(/_(\S[\s\S]*?\S)_/g, "$1")
    .replace(/[*_]+/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  const sessionBlock = `--- ASSISTANT NOTES ---\n${cleanedChatLog}\n--- END SESSION ---`;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: session, error: sessionError } = await supabase
    .from("meeting_assistant_sessions")
    .insert({
      meeting_id: id,
      user_id: user.id,
      content: cleanedChatLog,
    })
    .select("id, meeting_id, user_id, content, created_at")
    .single();

  if (!sessionError && session) {
    let appendedNotes: string | null = null;
    try {
      let meetingForNotes: MeetingNotesRow | null = null;
      let meetingFetchError: PostgrestError | null = null;
      {
        const response = await supabase
          .from("meetings")
          .select("assistant_notes, summary")
          .eq("id", id)
          .single();
        ({ data: meetingForNotes, error: meetingFetchError } = response as { data: MeetingNotesRow | null; error: PostgrestError | null; });
      }
      if (meetingFetchError && (meetingFetchError.message || "").includes("assistant_notes")) {
        const response = await supabase
          .from("meetings")
          .select("summary")
          .eq("id", id)
          .single();
        ({ data: meetingForNotes, error: meetingFetchError } = response as { data: MeetingNotesRow | null; error: PostgrestError | null; });
      }
      if (!meetingFetchError && meetingForNotes) {
        const baseNotes = meetingForNotes.assistant_notes ? meetingForNotes.assistant_notes.trim() : "";
        const newNotes = baseNotes ? `${baseNotes}\n\n${sessionBlock}` : sessionBlock;
        const { error: updateError } = await supabase.from("meetings").update({ assistant_notes: newNotes }).eq("id", id);
        if (!updateError) {
          appendedNotes = newNotes;
        } else {
          const message = updateError.message || "";
          if (message.includes("assistant_notes")) {
            const baseSummary = meetingForNotes.summary ? meetingForNotes.summary.trim() : "";
            const newSummary = baseSummary ? `${baseSummary}\n\n${sessionBlock}` : sessionBlock;
            const { error: fallbackError } = await supabase.from("meetings").update({ summary: newSummary }).eq("id", id);
            if (!fallbackError) appendedNotes = newSummary;
          }
        }
      }
    } catch {
      appendedNotes = null;
    }
    revalidatePath("/dashboard/briefings");
    return appendedNotes ? { type: "session", session, notes: appendedNotes } : { type: "session", session };
  }

  let meeting: MeetingNotesRow | null = null;
  let meetingError: PostgrestError | null = null;
  {
    const response = await supabase
      .from("meetings")
      .select("assistant_notes, summary")
      .eq("id", id)
      .single();
    ({ data: meeting, error: meetingError } = response as { data: MeetingNotesRow | null; error: PostgrestError | null; });
  }
  if (meetingError && (meetingError.message || "").includes("assistant_notes")) {
    const response = await supabase
      .from("meetings")
      .select("summary")
      .eq("id", id)
      .single();
    ({ data: meeting, error: meetingError } = response as { data: MeetingNotesRow | null; error: PostgrestError | null; });
  }
  if (meetingError) throw new Error(meetingError.message);
  if (!meeting) return null;

  const baseNotes = meeting.assistant_notes ? meeting.assistant_notes.trim() : "";
  const newNotes = baseNotes ? `${baseNotes}\n\n${sessionBlock}` : sessionBlock;
  
  const { error } = await supabase.from("meetings").update({ assistant_notes: newNotes }).eq("id", id);
  if (error) {
    const message = error.message || "";
    if (message.includes("assistant_notes") || message.includes("meeting_assistant_sessions")) {
      const baseSummary = meeting?.summary ? meeting.summary.trim() : "";
      const newSummary = baseSummary ? `${baseSummary}\n\n${sessionBlock}` : sessionBlock;
      const { error: fallbackError } = await supabase.from("meetings").update({ summary: newSummary }).eq("id", id);
      if (fallbackError) throw new Error(fallbackError.message);
      revalidatePath("/dashboard/briefings");
      return { type: "notes", notes: newSummary };
    }
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/briefings");
  return { type: "notes", notes: newNotes };
}

export async function getAssistantSessionsAction(meetingId: string) {
  const supabase = await createClient();

  const { data: sessions, error } = await supabase
    .from("meeting_assistant_sessions")
    .select("id, meeting_id, user_id, content, created_at")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (!error && sessions && sessions.length > 0) {
    return { type: "sessions", sessions };
  }

  let meeting: MeetingNotesRow | null = null;
  let meetingError: PostgrestError | null = null;
  {
    const response = await supabase
      .from("meetings")
      .select("assistant_notes, summary")
      .eq("id", meetingId)
      .single();
    ({ data: meeting, error: meetingError } = response as { data: MeetingNotesRow | null; error: PostgrestError | null; });
  }
  if (meetingError && (meetingError.message || "").includes("assistant_notes")) {
    const response = await supabase
      .from("meetings")
      .select("summary")
      .eq("id", meetingId)
      .single();
    ({ data: meeting, error: meetingError } = response as { data: MeetingNotesRow | null; error: PostgrestError | null; });
  }
  if (meetingError) throw new Error(meetingError.message);
  const notes = meeting?.assistant_notes || meeting?.summary || "";
  return { type: "notes", notes };
}

export async function getMeetingStorageStatusAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  let notesColumns = false;
  let notesAccessDenied = false;
  const { error: notesError } = await supabase
    .from("meetings")
    .select("meeting_notes, assistant_notes")
    .limit(1);
  if (!notesError) {
    notesColumns = true;
  } else if ((notesError.message || "").includes("permission denied")) {
    notesAccessDenied = true;
  } else if ((notesError.message || "").includes("meeting_notes") || (notesError.message || "").includes("assistant_notes")) {
    notesColumns = false;
  } else {
    throw new Error(notesError.message);
  }

  let sessionsTable = false;
  let sessionsAccessDenied = false;
  const { error: sessionsError } = await supabase
    .from("meeting_assistant_sessions")
    .select("id")
    .limit(1);
  if (!sessionsError) {
    sessionsTable = true;
  } else if ((sessionsError.message || "").includes("permission denied")) {
    sessionsAccessDenied = true;
  } else if ((sessionsError.message || "").includes("meeting_assistant_sessions")) {
    sessionsTable = false;
  } else {
    throw new Error(sessionsError.message);
  }

  let documentsTable = false;
  let documentsAccessDenied = false;
  const { error: documentsError } = await supabase
    .from("meeting_documents")
    .select("id")
    .limit(1);
  if (!documentsError) {
    documentsTable = true;
  } else if ((documentsError.message || "").includes("permission denied")) {
    documentsAccessDenied = true;
  } else if ((documentsError.message || "").includes("meeting_documents")) {
    documentsTable = false;
  } else {
    throw new Error(documentsError.message);
  }

  let documentsBucket = false;
  let documentsBucketAccessDenied = false;
  const { error: bucketError } = await supabase
    .storage
    .from("meeting-documents")
    .list("", { limit: 1 });
  if (!bucketError) {
    documentsBucket = true;
  } else if ((bucketError.message || "").includes("permission denied") || (bucketError.message || "").includes("Unauthorized")) {
    documentsBucketAccessDenied = true;
  } else if ((bucketError.message || "").toLowerCase().includes("bucket")) {
    documentsBucket = false;
  } else {
    throw new Error(bucketError.message);
  }

  return {
    notesColumns,
    sessionsTable,
    notesAccessDenied,
    sessionsAccessDenied,
    documentsTable,
    documentsAccessDenied,
    documentsBucket,
    documentsBucketAccessDenied,
  };
}

function sanitizeFilename(value: string) {
  const cleaned = value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .trim();
  return cleaned || "upload";
}

export async function uploadMeetingDocumentAction(meetingId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const file = formData.get("file");
  const notes = (formData.get("notes") as string) || "";
  if (!file || !(file instanceof File)) {
    throw new Error("No file provided.");
  }

  const safeName = sanitizeFilename(file.name);
  const filePath = `${user.id}/${meetingId}/${Date.now()}-${safeName}`;
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const { error: uploadError } = await supabase
    .storage
    .from("meeting-documents")
    .upload(filePath, fileBuffer, { contentType: file.type || "application/octet-stream" });
  if (uploadError) throw new Error(uploadError.message);

  let textContent = "";
  const lowerName = file.name.toLowerCase();
  const isText =
    (file.type && file.type.startsWith("text/")) ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".md");
  if (isText) {
    try {
      const rawText = await file.text();
      textContent = rawText.slice(0, 8000);
    } catch {
      textContent = "";
    }
  }

  const { data: doc, error: insertError } = await supabase
    .from("meeting_documents")
    .insert({
      meeting_id: meetingId,
      user_id: user.id,
      file_name: file.name,
      file_path: filePath,
      mime_type: file.type || null,
      size_bytes: file.size || null,
      notes: notes || null,
      text_content: textContent || null,
    })
    .select("id, file_name, file_path, mime_type, size_bytes, notes, text_content, created_at")
    .single();
  if (insertError) throw new Error(insertError.message);

  let signedUrl: string | null = null;
  const { data: signedData } = await supabase.storage
    .from("meeting-documents")
    .createSignedUrl(filePath, 60 * 60);
  if (signedData?.signedUrl) signedUrl = signedData.signedUrl;

  revalidatePath("/dashboard/briefings");
  return { ...doc, url: signedUrl };
}

export async function getMeetingDocumentsAction(meetingId: string) {
  const supabase = await createClient();
  const { data: docs, error } = await supabase
    .from("meeting_documents")
    .select("id, file_name, file_path, mime_type, size_bytes, notes, text_content, created_at")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const normalizedDocs = (docs || []) as MeetingDocumentRow[];
  const withUrls = await Promise.all(
    normalizedDocs.map(async (doc) => {
      try {
        const { data: signedData } = await supabase.storage
          .from("meeting-documents")
          .createSignedUrl(doc.file_path, 60 * 60);
        return { ...doc, url: signedData?.signedUrl || null };
      } catch {
        return { ...doc, url: null };
      }
    })
  );

  return withUrls;
}

export async function deleteMeetingDocumentAction(documentId: string, filePath: string) {
  const supabase = await createClient();
  const { error: storageError } = await supabase.storage
    .from("meeting-documents")
    .remove([filePath]);
  if (storageError) {
    const message = storageError.message || "";
    if (!message.toLowerCase().includes("not found")) {
      throw new Error(storageError.message);
    }
  }

  const { error } = await supabase.from("meeting_documents").delete().eq("id", documentId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/briefings");
  return true;
}

// *** FIXED: HARD DELETE (No Archive Column Needed) ***
export async function deleteMeetingAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error, count } = await supabase
    .from("meetings")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    const message = error.message || "";
    if (message.includes("user_id")) {
      const { error: fallbackError, count: fallbackCount } = await supabase
        .from("meetings")
        .delete({ count: "exact" })
        .eq("id", id);
      if (fallbackError) {
        console.error("Delete failed:", fallbackError);
        throw new Error(fallbackError.message);
      }
      if (!fallbackCount) {
        throw new Error("Delete failed: Meeting not found.");
      }
      revalidatePath("/dashboard/briefings");
      return;
    }
    console.error("Delete failed:", error);
    throw new Error(error.message);
  }
  if (!count) {
    throw new Error("Delete failed: Meeting not found or access denied.");
  }
  revalidatePath("/dashboard/briefings");
}

// *** AI ACTION (With Error Reporting) ***
export async function chatWithMeetingAIAction(meetingContext: string, userQuestion: string, chatContext?: string, documentContext?: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "Critical Error: OPENAI_API_KEY is missing in Vercel Settings.";

  const cleanAssistantText = (text: string) =>
    text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/```[a-zA-Z0-9]*\n([\s\S]*?)```/g, "$1")
      .replace(/```([\s\S]*?)```/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
      .replace(/(^|\n)#{1,6}\s+/g, "$1")
      .replace(/(^|\n)>\s?/g, "$1")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/\*(\S[\s\S]*?\S)\*/g, "$1")
      .replace(/_(\S[\s\S]*?\S)_/g, "$1")
      .replace(/[*_]+/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .trim();

  const systemPrompt = `
    You are the BeTeachable Business Assistant. Methodology: "TUFF LOVE".
    1. Be direct. No fluff. Focus on EXECUTION.
    2. If asked for samples, provide them IMMEDIATELY.
    3. If the user is stalling, call them out.
    4. Use plain text only. No markdown. Use short labeled sections like "SUMMARY:".
  `;

  const notesContext = meetingContext?.trim() || "No notes yet.";
  const chatHistoryContext = chatContext?.trim();
  const docsContext = documentContext?.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Meeting Notes:\n${notesContext}${docsContext ? `\n\nAttached Documents:\n${docsContext}` : ""}${chatHistoryContext ? `\n\nPrevious Coaching Chat:\n${chatHistoryContext}` : ""}\n\nUser Question: ${userQuestion}` }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
        const errText = await response.text();
        return `OpenAI API Error (${response.status}): ${errText}`;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "AI Error: Received empty response.";
    return cleanAssistantText(content);

  } catch (error: unknown) {
    return `Connection Error: ${getErrorMessage(error)}`;
  }
}

// ==========================================
// 2. TEAM ASSIGNMENTS
// ==========================================
export async function toggleAssignmentAction(memberId: string, companyId: string, isAssigned: boolean) {
  const supabase = await createClient();

  if (isAssigned) {
    await supabase
      .from("company_assignments")
      .delete()
      .eq("member_id", memberId)
      .eq("company_id", companyId);
  } else {
    await supabase.from("company_assignments").insert({
      member_id: memberId,
      company_id: companyId,
    });
  }

  revalidatePath("/dashboard/the-unit");
  revalidatePath(`/dashboard/the-unit/${memberId}`);
}

// ==========================================
// 3. STUBS (PREVENTS "ACTION NOT FOUND" CRASH)
// ==========================================
export async function createLeadAction() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const columns = await getLeadColumnSet(supabase);
    let teamId: string | null = null;
    if (!columns || columns.has("team_id")) {
      try {
        teamId = await getActiveTeamId(supabase);
      } catch {
        teamId = null;
      }
    }

    const basePayload: Record<string, unknown> = {
      user_id: user.id,
      company_name: "New Prospect",
      contact_name: "",
      company: "New Prospect",
      name: "",
      email: "",
      phone: "",
      status: "New",
      pipeline_stage: "Prospecting",
      campaign: "General",
      value: 0,
    };
    if (teamId) basePayload.team_id = teamId;

    const payloads: Record<string, unknown>[] = [];
    const hasUserId = !columns || columns.has("user_id");
    const hasTeamId = Boolean(teamId);
    if (columns) {
      const filtered: Record<string, unknown> = {};
      Object.entries(basePayload).forEach(([key, value]) => {
        if (columns.has(key)) filtered[key] = value;
      });
      if (Object.keys(filtered).length > 0) payloads.push(filtered);
    } else {
      payloads.push({ ...basePayload });
    }

    payloads.push({
      ...(hasUserId ? { user_id: user.id } : {}),
      ...(hasTeamId ? { team_id: teamId } : {}),
      company: "New Prospect",
      name: "",
      email: "",
      phone: "",
      status: "New",
    });
    payloads.push({
      ...(hasUserId ? { user_id: user.id } : {}),
      ...(hasTeamId ? { team_id: teamId } : {}),
      company_name: "New Prospect",
      contact_name: "",
      email: "",
      phone: "",
      status: "New",
    });
    payloads.push({
      ...(hasUserId ? { user_id: user.id } : {}),
      ...(hasTeamId ? { team_id: teamId } : {}),
      status: "New",
    });

    let lastError = "";
    for (const attempt of payloads) {
      const result = await supabase
        .from("leads")
        .insert(attempt)
        .select("id")
        .single();

      if (!result.error && result.data?.id) {
        revalidatePath("/dashboard/tactix");
        revalidatePath("/dashboard/intel");
        return { leadId: result.data.id };
      }

      const message = result.error?.message || "";
      lastError = message || lastError;
      const lower = message.toLowerCase();

      if (lower.includes("row violates row-level security")) {
        return { error: "Lead insert blocked by security policy. Apply leads insert policy." };
      }

      const missingColumnMatch =
        message.match(/column \"([^\"]+)\"/i) ||
        message.match(/'([^']+)' column/i) ||
        message.match(/find the '([^']+)' column/i);
      if (missingColumnMatch?.[1]) {
        const missingColumn = missingColumnMatch[1];
        delete attempt[missingColumn];
        if (missingColumn === "user_id" && hasUserId) {
          attempt.user_id = user.id;
        }
        if (missingColumn === "team_id" && hasTeamId) {
          attempt.team_id = teamId;
        }
        if (Object.keys(attempt).length > 0) {
          payloads.push({ ...attempt });
        }
      }
    }

    return { error: lastError || "Unable to create lead." };
  } catch (err: unknown) {
    return { error: getErrorMessage(err) || "Unable to create lead." };
  }
}

export async function updateLeadAction(leadId: string, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const columns = await getLeadColumnSet(supabase);
    let teamId: string | null = null;
    if (!columns || columns.has("team_id")) {
      try {
        teamId = await getActiveTeamId(supabase);
      } catch {
        teamId = null;
      }
    }

    const companyName = (formData.get("company_name") as string) || (formData.get("company") as string) || "";
    const contactName = (formData.get("contact_name") as string) || (formData.get("name") as string) || "";
    const email = (formData.get("email") as string) || "";
    const phone = (formData.get("phone") as string) || "";
    const status = (formData.get("status") as string) || "";
    const pipelineStage = (formData.get("pipeline_stage") as string) || "";
    const campaign = (formData.get("campaign") as string) || "";
    const leadNotes = (formData.get("lead_notes") as string) || "";

    if (leadNotes && columns && !columns.has("lead_notes")) {
      return { error: "lead_notes column is missing. Apply migration 20250125191500_add_lead_notes.sql." };
    }

    let updates: Record<string, unknown> = {
      company_name: companyName,
      contact_name: contactName,
      email,
      phone,
      status,
      pipeline_stage: pipelineStage,
      campaign,
      lead_notes: leadNotes,
    };
    if (teamId) updates.team_id = teamId;

    if (columns) {
      const filtered: Record<string, unknown> = {};
      Object.entries(updates).forEach(([key, value]) => {
        if (columns.has(key)) filtered[key] = value;
      });
      updates = filtered;
    }

    const attempts: Record<string, unknown>[] = [updates];
    attempts.push({
      company_name: companyName,
      contact_name: contactName,
      email,
      phone,
      status,
      pipeline_stage: pipelineStage,
      campaign,
      lead_notes: leadNotes,
      ...(teamId ? { team_id: teamId } : {}),
    });
    attempts.push({
      company: companyName,
      name: contactName,
      email,
      phone,
      status,
      lead_notes: leadNotes,
      ...(teamId ? { team_id: teamId } : {}),
    });

    let lastError = "";
    for (const attempt of attempts) {
      let query = supabase.from("leads").update(attempt).eq("id", leadId);
      const usesUserFilter = !columns || columns.has("user_id");
      if (usesUserFilter) {
        query = query.eq("user_id", user.id);
      }
      const { data: updatedRows, error } = await query.select("id");
      if (!error && updatedRows && updatedRows.length > 0) {
        revalidatePath("/dashboard/tactix");
        revalidatePath("/dashboard/intel");
        revalidatePath(`/dashboard/intel/${leadId}`);
        return { ok: true };
      }
      if (!error && (!updatedRows || updatedRows.length === 0) && usesUserFilter) {
        const { data: fallbackRows, error: fallbackError } = await supabase
          .from("leads")
          .update(attempt)
          .eq("id", leadId)
          .select("id");
        if (!fallbackError && fallbackRows && fallbackRows.length > 0) {
          revalidatePath("/dashboard/tactix");
          revalidatePath("/dashboard/intel");
          revalidatePath(`/dashboard/intel/${leadId}`);
          return { ok: true };
        }
      }

      const message = error?.message || "Update blocked. Lead not found or access denied.";
      lastError = message || lastError;
      if (leadNotes && message.toLowerCase().includes("lead_notes")) {
        return { error: "lead_notes column is missing. Apply migration 20250125191500_add_lead_notes.sql." };
      }
      if (message.includes("pipeline_stage") || message.includes("campaign")) {
        delete attempt.pipeline_stage;
        delete attempt.campaign;
      }
      const missingColumnMatch =
        message.match(/column \"([^\"]+)\"/i) ||
        message.match(/'([^']+)' column/i) ||
        message.match(/find the '([^']+)' column/i);
      if (missingColumnMatch?.[1]) {
        delete attempt[missingColumnMatch[1]];
      }
      if (Object.keys(attempt).length > 0) {
        attempts.push({ ...attempt });
      }
    }

    return { error: lastError || "Unable to save lead." };
  } catch (err: unknown) {
    return { error: getErrorMessage(err) || "Unable to save lead." };
  }
}

export async function saveLeadNotesAction(leadId: string, notes: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const columns = await getLeadColumnSet(supabase);
    if (columns && !columns.has("lead_notes")) {
      return { error: "lead_notes column is missing. Apply migration 20250125191500_add_lead_notes.sql." };
    }

    const noteContent = (notes || "").trim();
    if (!noteContent) {
      return { error: "Note is empty." };
    }

    let existingNotes = "";
    let noteEntryInserted = false;
    const noteEntryPayload = { lead_id: leadId, user_id: user.id, content: noteContent };
    const insertNoteEntry = async () => {
      if (noteEntryInserted) return;
      try {
        await supabase.from("lead_note_entries").insert(noteEntryPayload);
        noteEntryInserted = true;
      } catch {
        // ignore note archive failures
      }
    };
    let selectQuery = supabase.from("leads").select("lead_notes").eq("id", leadId);
    const usesUserFilter = !columns || columns.has("user_id");
    if (usesUserFilter) {
      selectQuery = selectQuery.eq("user_id", user.id);
    }
    let { data: noteRows, error: noteError } = await selectQuery;
    if (noteError || !noteRows || noteRows.length === 0) {
      if (usesUserFilter) {
        const { data: fallbackRows, error: fallbackError } = await supabase
          .from("leads")
          .select("lead_notes")
          .eq("id", leadId);
        if (!fallbackError && fallbackRows && fallbackRows.length > 0) {
          noteRows = fallbackRows;
          noteError = null;
        }
      }
    }
    if (!noteError && noteRows && noteRows.length > 0) {
      existingNotes = noteRows[0]?.lead_notes || "";
    }

    const noteBlock = `[${new Date().toLocaleString()}] Note\n${noteContent}`;
    const combinedNotes = existingNotes ? `${existingNotes}\n\n${noteBlock}` : noteBlock;
    const updates = { lead_notes: combinedNotes };
    let query = supabase.from("leads").update(updates).eq("id", leadId);
    if (usesUserFilter) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query.select("lead_notes");
    if (!error && data && data.length > 0) {
      await insertNoteEntry();
      revalidatePath("/dashboard/intel");
      revalidatePath(`/dashboard/intel/${leadId}`);
      return { ok: true, lead_notes: data[0].lead_notes };
    }

    if (!error && (!data || data.length === 0)) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", leadId)
        .select("lead_notes");
      if (fallbackError || !fallbackRows || fallbackRows.length === 0) {
        return { error: fallbackError?.message || "Update blocked. Lead not found or access denied." };
      }
      await insertNoteEntry();
      revalidatePath("/dashboard/intel");
      revalidatePath(`/dashboard/intel/${leadId}`);
      return { ok: true, lead_notes: fallbackRows[0].lead_notes };
    }

    if (error && (error.message || "").includes("user_id")) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", leadId)
        .select("lead_notes");
      if (fallbackError || !fallbackRows || fallbackRows.length === 0) {
        return { error: fallbackError?.message || "Update blocked. Lead not found or access denied." };
      }
      await insertNoteEntry();
      revalidatePath("/dashboard/intel");
      revalidatePath(`/dashboard/intel/${leadId}`);
      return { ok: true, lead_notes: fallbackRows[0].lead_notes };
    }

    await insertNoteEntry();
    if (noteEntryInserted) {
      revalidatePath("/dashboard/intel");
      revalidatePath(`/dashboard/intel/${leadId}`);
      return { ok: true, warning: "Note saved to archive, but lead notes could not be updated." };
    }
    return { error: error?.message || "Unable to save notes." };
  } catch (err: unknown) {
    return { error: getErrorMessage(err) || "Unable to save notes." };
  }
}

export async function updateLeadNoteEntryAction(entryId: string, leadId: string, content: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const trimmed = (content || "").trim();
    if (!trimmed) return { error: "Note is empty." };

    const { data, error } = await supabase
      .from("lead_note_entries")
      .update({ content: trimmed })
      .eq("id", entryId)
      .eq("user_id", user.id)
      .select("id");

    if (!error && data && data.length > 0) {
      revalidatePath("/dashboard/intel");
      revalidatePath(`/dashboard/intel/${leadId}`);
      return { ok: true };
    }

    if (!error && (!data || data.length === 0)) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("lead_note_entries")
        .update({ content: trimmed })
        .eq("id", entryId)
        .select("id");
      if (fallbackError || !fallbackRows || fallbackRows.length === 0) {
        return { error: fallbackError?.message || "Update blocked. Note not found or access denied." };
      }
      revalidatePath("/dashboard/intel");
      revalidatePath(`/dashboard/intel/${leadId}`);
      return { ok: true };
    }

    if (error && (error.message || "").includes("user_id")) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("lead_note_entries")
        .update({ content: trimmed })
        .eq("id", entryId)
        .select("id");
      if (fallbackError || !fallbackRows || fallbackRows.length === 0) {
        return { error: fallbackError?.message || "Update blocked. Note not found or access denied." };
      }
      revalidatePath("/dashboard/intel");
      revalidatePath(`/dashboard/intel/${leadId}`);
      return { ok: true };
    }

    return { error: error?.message || "Unable to update note." };
  } catch (err: unknown) {
    return { error: getErrorMessage(err) || "Unable to update note." };
  }
}

export async function deleteLeadNoteEntryAction(entryId: string, leadId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error, count } = await supabase
      .from("lead_note_entries")
      .delete({ count: "exact" })
      .eq("id", entryId)
      .eq("user_id", user.id);

    if (!error && count) {
      revalidatePath("/dashboard/intel");
      revalidatePath(`/dashboard/intel/${leadId}`);
      return { ok: true };
    }

    if (!error && !count) {
      const { error: fallbackError, count: fallbackCount } = await supabase
        .from("lead_note_entries")
        .delete({ count: "exact" })
        .eq("id", entryId);
      if (fallbackError || !fallbackCount) {
        return { error: fallbackError?.message || "Delete blocked. Note not found or access denied." };
      }
      revalidatePath("/dashboard/intel");
      revalidatePath(`/dashboard/intel/${leadId}`);
      return { ok: true };
    }

    if (error && (error.message || "").includes("user_id")) {
      const { error: fallbackError, count: fallbackCount } = await supabase
        .from("lead_note_entries")
        .delete({ count: "exact" })
        .eq("id", entryId);
      if (fallbackError || !fallbackCount) {
        return { error: fallbackError?.message || "Delete blocked. Note not found or access denied." };
      }
      revalidatePath("/dashboard/intel");
      revalidatePath(`/dashboard/intel/${leadId}`);
      return { ok: true };
    }

    return { error: error?.message || "Unable to delete note." };
  } catch (err: unknown) {
    return { error: getErrorMessage(err) || "Unable to delete note." };
  }
}

export async function deleteLeadAction(leadId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error, count } = await supabase
    .from("leads")
    .delete({ count: "exact" })
    .eq("id", leadId)
    .eq("user_id", user.id);

  if (error) {
    const message = error.message || "";
    if (message.includes("user_id")) {
      const { error: fallbackError, count: fallbackCount } = await supabase
        .from("leads")
        .delete({ count: "exact" })
        .eq("id", leadId);
      if (fallbackError) throw new Error(fallbackError.message);
      if (!fallbackCount) throw new Error("Delete failed: Lead not found.");
      revalidatePath("/dashboard/tactix");
      revalidatePath("/dashboard/intel");
      return;
    }
    throw new Error(error.message);
  }
  if (!count) throw new Error("Delete failed: Lead not found or access denied.");

  revalidatePath("/dashboard/tactix");
  revalidatePath("/dashboard/intel");
}
export async function runDeepResearchAction(
  leadId: string,
  input?: { email?: string; phone?: string; contactName?: string; companyName?: string; linkedinUrl?: string }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  let lead: LeadRecord | null = null;
  let leadError: PostgrestError | null = null;
  {
    const response = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("user_id", user.id)
      .single();
    ({ data: lead, error: leadError } = response as { data: LeadRecord | null; error: PostgrestError | null; });
  }
  if (leadError && (leadError.message || "").includes("user_id")) {
    const response = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();
    ({ data: lead, error: leadError } = response as { data: LeadRecord | null; error: PostgrestError | null; });
  }
  if (leadError || !lead) throw new Error("Lead not found.");

  const leadRecord = lead;
  const contactName = (input?.contactName || "").trim() || asString(leadRecord.contact_name) || asString(leadRecord.name);
  const companyName = (input?.companyName || "").trim() || asString(leadRecord.company_name) || asString(leadRecord.company);
  const emailInput = (input?.email || "").trim() || asString(leadRecord.email) || asString(leadRecord.verified_email);
  const phoneInput = (input?.phone || "").trim() || asString(leadRecord.phone) || asString(leadRecord.verified_phone);
  const profileInput =
    (input?.linkedinUrl || "").trim() ||
    asString(leadRecord.linkedin_url) ||
    `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(`${contactName} ${companyName}`.trim())}`;

  const hasEmail = Boolean(emailInput);
  const hasPhone = Boolean(phoneInput);
  const hasName = Boolean(contactName);
  const hasCompany = Boolean(companyName);
  const hasProfile = Boolean(profileInput);

  if (!hasEmail && !hasPhone && !(hasName && hasCompany) && !hasProfile) {
    const infoMessage =
      "Add an email or phone, or provide a full name plus company before running research.";
    const updates = {
      research_status: "Needs Info",
      research_error: infoMessage,
      research_last_run: new Date().toISOString(),
    };
    await supabase.from("leads").update(updates).eq("id", leadId);
    revalidatePath("/dashboard/tactix");
    revalidatePath("/dashboard/intel");
    revalidatePath(`/dashboard/intel/${leadId}`);
    return {
      research_status: "Needs Info",
      research_error: infoMessage,
      research_last_run: updates.research_last_run,
      message: infoMessage,
    };
  }
  if (!contactName && !companyName) {
    throw new Error("Add a company or contact name before running research.");
  }

  const pdlApiKey = process.env.PEOPLE_SEARCH_API_KEY || process.env.PDL_API_KEY || process.env.PEOPLE_DATA_LABS_API_KEY;
  const serpApiKey = process.env.SERPAPI_API_KEY;
  const columns = await getLeadColumnSet(supabase);
  let verifiedEmail = asNullableString(leadRecord.verified_email) ?? asNullableString(leadRecord.email);
  let verifiedPhone = asNullableString(leadRecord.verified_phone) ?? asNullableString(leadRecord.phone);
  let linkedinUrl = asString(leadRecord.linkedin_url) || profileInput;
  let researchStatus = "Completed";
  let researchError: string | null = null;
  let message = "Research updated.";

  const verificationRows: Array<{
    lead_id: string;
    user_id: string;
    provider: string;
    status: string;
    confidence?: number | null;
    matched_fields?: string[] | null;
    evidence?: Record<string, unknown> | null;
  }> = [];

  let pdlStatus = "Needs Setup";
  let pdlMessage: string | null = null;
  let pdlConfidence: number | null = null;
  const pdlMatchedFields: string[] = [];
  let pdlEvidence: Record<string, unknown> | null = null;

  if (!pdlApiKey) {
    pdlStatus = "Needs Setup";
    pdlMessage = "People Search is not configured. Add the required API key.";
  } else {
    const params = new URLSearchParams();
    if (emailInput) params.set("email", emailInput);
    if (!params.has("email") && phoneInput) params.set("phone", phoneInput);
    if (!params.has("email") && !params.has("phone")) {
      if (contactName) params.set("name", contactName);
      if (companyName) params.set("company", companyName);
      if (!contactName && profileInput) params.set("profile", profileInput);
    }

    const response = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params.toString()}`, {
      headers: { "X-Api-Key": pdlApiKey },
    });

    const responseText = await response.text();
    let data: PdlResponse | null = null;
    try {
      data = responseText ? (JSON.parse(responseText) as PdlResponse) : null;
    } catch {
      data = null;
    }

    const apiMessage = data?.error?.message || data?.message || "";
    const isNoMatchMessage = /no records were found|no match|not found/i.test(apiMessage);

    if (response.status === 404 || isNoMatchMessage) {
      pdlStatus = "No match";
      pdlMessage = "No matching person found.";
    } else if (!response.ok) {
      pdlStatus = "Failed";
      pdlMessage = apiMessage || `People search error (${response.status}).`;
    } else if (typeof data?.status === "number" && data.status !== 200) {
      pdlStatus = "No match";
      pdlMessage = "No matching person found.";
    } else if (data) {
      const pdlEmail = data?.email || data?.emails?.[0]?.address || null;
      const pdlPhone = data?.phone_numbers?.[0]?.number || null;
      const pdlLinkedIn = data?.linkedin_url || null;

      if (pdlEmail) {
        verifiedEmail = pdlEmail;
        pdlMatchedFields.push("email");
      }
      if (pdlPhone) {
        verifiedPhone = pdlPhone;
        pdlMatchedFields.push("phone");
      }
      if (pdlLinkedIn) {
        linkedinUrl = pdlLinkedIn;
        pdlMatchedFields.push("linkedin_url");
      }
      if (data?.full_name || contactName) pdlMatchedFields.push("name");
      if (data?.job_company_name || companyName) pdlMatchedFields.push("company");

      const confidenceBase = pdlMatchedFields.includes("email") || pdlMatchedFields.includes("phone") ? 90 : 60;
      pdlConfidence = Math.min(100, confidenceBase + Math.max(0, pdlMatchedFields.length - 2) * 5);
      pdlStatus = "Completed";
      pdlMessage = null;
      pdlEvidence = {
        query: Object.fromEntries(params.entries()),
        match: {
          pdl_id: data?.id || null,
          name: data?.full_name || contactName || null,
          company: data?.job_company_name || companyName || null,
          email: pdlEmail,
          phone: pdlPhone,
          linkedin_url: pdlLinkedIn,
        },
      };
    }
  }

  verificationRows.push({
    lead_id: leadId,
    user_id: user.id,
    provider: "pdl",
    status: pdlStatus,
    confidence: pdlConfidence,
    matched_fields: pdlMatchedFields.length ? pdlMatchedFields : null,
    evidence: pdlEvidence,
  });

  let serpStatus = "Needs Setup";
  let serpMessage: string | null = null;
  let serpConfidence: number | null = null;
  const serpMatchedFields: string[] = [];
  let serpEvidence: Record<string, unknown> | null = null;

  const serpQueryBase = `${contactName} ${companyName}`.trim() || emailInput || phoneInput;

  if (!serpApiKey) {
    serpStatus = "Needs Setup";
    serpMessage = "People Search web lookup is not configured. Add the required API key.";
  } else if (serpQueryBase) {
    const serpParams = new URLSearchParams({
      engine: "google",
      q: serpQueryBase,
      num: "5",
      api_key: serpApiKey,
    });
    const serpResponse = await fetch(`https://serpapi.com/search.json?${serpParams.toString()}`);
    const serpText = await serpResponse.text();
    let serpData: SerpResponse | null = null;
    try {
      serpData = serpText ? (JSON.parse(serpText) as SerpResponse) : null;
    } catch {
      serpData = null;
    }

    if (!serpResponse.ok) {
      serpStatus = "Failed";
      serpMessage = serpData?.error || serpData?.error_message || `SerpAPI error (${serpResponse.status}).`;
    } else {
      const results = Array.isArray(serpData?.organic_results) ? serpData.organic_results.slice(0, 5) : [];
      if (results.length === 0) {
        serpStatus = "No match";
        serpMessage = "No matching results found.";
      } else {
        serpStatus = "Completed";
        serpMessage = null;

        const normalizedName = contactName.toLowerCase();
        const normalizedCompany = companyName.toLowerCase();
        let bestScore = 0;
        let bestLinkedIn: string | null = null;

        results.forEach((result) => {
          const title = (result?.title || "").toLowerCase();
          const snippet = (result?.snippet || "").toLowerCase();
          const rawLink = result?.link || null;
          const link = (rawLink || "").toLowerCase();
          let score = 0;

          if (normalizedName && (title.includes(normalizedName) || snippet.includes(normalizedName))) {
            score += 0.35;
            if (!serpMatchedFields.includes("name")) serpMatchedFields.push("name");
          }
          if (normalizedCompany && (title.includes(normalizedCompany) || snippet.includes(normalizedCompany))) {
            score += 0.25;
            if (!serpMatchedFields.includes("company")) serpMatchedFields.push("company");
          }
          if (link.includes("linkedin.com")) {
            score += 0.2;
            if (!serpMatchedFields.includes("linkedin_url")) serpMatchedFields.push("linkedin_url");
            if (!bestLinkedIn && rawLink && link.includes("linkedin.com/in")) bestLinkedIn = rawLink;
          }
          if (emailInput && snippet.includes(emailInput.toLowerCase())) {
            score += 0.2;
            if (!serpMatchedFields.includes("email")) serpMatchedFields.push("email");
          }

          if (score > bestScore) bestScore = score;
        });

        const isSearchUrl = /linkedin\.com\/search/i.test(linkedinUrl || "");
        if (bestLinkedIn && (isSearchUrl || !asString(leadRecord.linkedin_url))) {
          linkedinUrl = bestLinkedIn;
        }

        serpConfidence = Math.round(Math.min(1, bestScore) * 100);
        serpEvidence = {
          query: serpQueryBase,
          results: results.map((result) => ({
            title: result?.title || null,
            link: result?.link || null,
            snippet: result?.snippet || null,
            position: (result as Record<string, unknown>)?.position ?? null,
          })),
        };
      }
    }
  }

  verificationRows.push({
    lead_id: leadId,
    user_id: user.id,
    provider: "serpapi",
    status: serpStatus,
    confidence: serpConfidence,
    matched_fields: serpMatchedFields.length ? serpMatchedFields : null,
    evidence: serpEvidence,
  });

  const providerStatuses = [pdlStatus, serpStatus];
  if (providerStatuses.every((status) => status === "Needs Setup")) {
    researchStatus = "Needs Setup";
    researchError = "People Search needs setup. Add the required API keys.";
    message = "People Search needs setup. Add the required API keys and retry.";
  } else if (providerStatuses.some((status) => status === "Completed")) {
    researchStatus = "Completed";
    researchError = null;
    message = "Verification updated.";
  } else if (providerStatuses.every((status) => status === "No match" || status === "Needs Setup")) {
    researchStatus = "No match";
    researchError = null;
    message = "No matching person found.";
  } else {
    researchStatus = "Failed";
    researchError = pdlMessage || serpMessage || "Verification failed. Check your API keys and limits.";
    message = "Verification failed. Check your API keys and limits.";
  }

  if (verificationRows.length > 0) {
    await supabase.from("lead_verifications").insert(verificationRows);
  }

  const emailToPersist = emailInput || verifiedEmail || asNullableString(leadRecord.email) || null;
  const phoneToPersist = phoneInput || verifiedPhone || asNullableString(leadRecord.phone) || null;
  const searchQuery = `${contactName} ${companyName}`.trim() || emailToPersist || phoneToPersist || "";
  const encodedQuery = encodeURIComponent(searchQuery);
  const quickLinks = searchQuery
    ? {
        google: `https://www.google.com/search?q=${encodedQuery}`,
        linkedin: `https://www.linkedin.com/search/results/all/?keywords=${encodedQuery}`,
        facebook: `https://www.facebook.com/search/top?q=${encodedQuery}`,
      }
    : {};
  const webTopLinks: WebTopLink[] = Array.isArray(serpEvidence?.results)
    ? (serpEvidence.results as SerpResult[])
        .filter((item): item is SerpResult & { link: string } => typeof item?.link === "string" && item.link.length > 0)
        .slice(0, 3)
        .map((item) => ({ title: item.title || item.link, link: item.link }))
    : [];
  let noteWarning: string | null = null;
  let nextNotes: string | null = null;
  if (!columns || columns.has("lead_notes")) {
    const noteLines = [
      `[${new Date().toLocaleString()}] Dig Deep`,
      `Status: ${researchStatus}`,
      `BeTeachable Business Assistant People Search (Core): ${pdlStatus}${pdlMessage ? ` - ${pdlMessage}` : ""}`,
      `BeTeachable Business Assistant People Search (Web): ${serpStatus}${serpMessage ? ` - ${serpMessage}` : ""}`,
      `Email: ${emailToPersist || "N/A"}`,
      `Phone: ${phoneToPersist || "N/A"}`,
      `LinkedIn: ${linkedinUrl || "N/A"}`,
    ];
    if (Object.keys(quickLinks).length > 0) {
      noteLines.push("Quick Searches:");
      if (quickLinks.google) noteLines.push(`- Google: ${quickLinks.google}`);
      if (quickLinks.linkedin) noteLines.push(`- LinkedIn: ${quickLinks.linkedin}`);
      if (quickLinks.facebook) noteLines.push(`- Facebook: ${quickLinks.facebook}`);
    }
    if (webTopLinks.length > 0) {
      noteLines.push("Top Web Results:");
      webTopLinks.forEach((result) => {
        noteLines.push(`- ${result.title}: ${result.link}`);
      });
    }
    const researchNote = noteLines.join("\n");
    const existingNotes = asString(leadRecord.lead_notes).trim();
    nextNotes = existingNotes ? `${existingNotes}\n\n${researchNote}` : researchNote;
    try {
      await supabase.from("lead_note_entries").insert({
        lead_id: leadId,
        user_id: user.id,
        content: researchNote,
      });
    } catch {
      // ignore note archive failures
    }
  } else {
    noteWarning = "Lead notes are not configured. Apply migration 20250125191500_add_lead_notes.sql.";
  }

  const snapshot = {
    searched_at: new Date().toISOString(),
    status: researchStatus,
    query: searchQuery || null,
    quick_links: quickLinks,
    people_search: {
      core: {
        status: pdlStatus,
        message: pdlMessage,
        matched_fields: pdlMatchedFields.length ? pdlMatchedFields : null,
        confidence: pdlConfidence,
        match: pdlEvidence?.match || null,
      },
      web: {
        status: serpStatus,
        message: serpMessage,
        matched_fields: serpMatchedFields.length ? serpMatchedFields : null,
        confidence: serpConfidence,
        results: webTopLinks,
      },
    },
  };

  const updates = {
    research_status: researchStatus,
    verified_email: verifiedEmail,
    verified_phone: verifiedPhone,
    linkedin_url: linkedinUrl,
    research_last_run: new Date().toISOString(),
    research_error: researchError,
    ...(emailToPersist ? { email: emailToPersist } : {}),
    ...(phoneToPersist ? { phone: phoneToPersist } : {}),
    ...(nextNotes ? { lead_notes: nextNotes } : {}),
    ...(columns && !columns.has("lead_research_snapshot") ? {} : { lead_research_snapshot: snapshot }),
  };

  const updateResponse = await supabase
    .from("leads")
    .update(updates)
    .eq("id", leadId)
    .eq("user_id", user.id)
    .select("id");
  const { data: updatedRows, error: updateError } = updateResponse as {
    data: Array<{ id: string }> | null;
    error: PostgrestError | null;
  };
  let error = updateError;

  if (!error && (!updatedRows || updatedRows.length === 0)) {
    error = makePostgrestError("Update blocked. Lead not found or access denied.");
  }

  if (error) {
    const message = error.message || "";
    if (message.includes("user_id") || message.includes("Update blocked")) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", leadId)
        .select("id");
      if (fallbackError || !fallbackRows || fallbackRows.length === 0) {
        error = fallbackError || makePostgrestError("Update blocked. Lead not found or access denied.");
      } else {
        error = null;
      }
    }
    if (error) {
      const trimmedUpdates: Record<string, unknown> = { ...updates };
      ["research_status", "verified_email", "verified_phone", "linkedin_url", "research_last_run", "research_error", "email", "phone", "lead_notes", "lead_research_snapshot"].forEach((field) => {
        if ((error?.message || "").includes(field)) {
          if (field === "lead_notes") {
            noteWarning = "Lead notes are not configured. Apply migration 20250125191500_add_lead_notes.sql.";
          }
          delete trimmedUpdates[field];
        }
      });
      if (Object.keys(trimmedUpdates).length > 0) {
        const { data: retryRows, error: retryError } = await supabase
          .from("leads")
          .update(trimmedUpdates)
          .eq("id", leadId)
          .select("id");
        if (retryError || !retryRows || retryRows.length === 0) {
          throw new Error(retryError?.message || "Update blocked. Lead not found or access denied.");
        }
      } else {
        throw new Error(error.message);
      }
    }
  }

  revalidatePath("/dashboard/tactix");
  revalidatePath("/dashboard/intel");
  revalidatePath(`/dashboard/intel/${leadId}`);

  return {
    research_status: researchStatus,
    verified_email: verifiedEmail,
    verified_phone: verifiedPhone,
    linkedin_url: linkedinUrl,
    research_last_run: updates.research_last_run,
    research_error: researchError,
    message: noteWarning ? `${message} ${noteWarning}` : message,
  };
}

export async function generateTuffLoveScriptAction(
  leadId: string,
  industry: string,
  context?: {
    companyName?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    linkedinUrl?: string;
    leadNotes?: string;
    researchSnapshot?: Record<string, unknown> | null;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const columns = await getLeadColumnSet(supabase);
  if (columns && !columns.has("ai_generated_script")) {
    return { error: "ai_generated_script column is missing. Apply the lead research migration." };
  }

  const leadSelectFields = [
    "company_name",
    "company",
    "contact_name",
    "name",
    "email",
    "lead_notes",
    "lead_research_snapshot",
    "verified_email",
    "verified_phone",
    "linkedin_url",
  ];
  const leadSelect = columns ? leadSelectFields.filter((field) => columns.has(field)).join(",") : leadSelectFields.join(",");
  let lead: LeadRecord | null = null;
  let leadError: PostgrestError | null = null;
  {
    const response = await supabase
      .from("leads")
      .select(leadSelect)
      .eq("id", leadId)
      .single();
    ({ data: lead, error: leadError } = response as { data: LeadRecord | null; error: PostgrestError | null; });
  }
  if (leadError && (leadError.message || "").includes("column")) {
    const fallbackSelect = "company_name, company, contact_name, name, email";
    const response = await supabase
      .from("leads")
      .select(fallbackSelect)
      .eq("id", leadId)
      .single();
    ({ data: lead, error: leadError } = response as { data: LeadRecord | null; error: PostgrestError | null; });
  }
  if (leadError || !lead) {
    const { data: fallbackLead, error: fallbackLeadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();
    if (!fallbackLeadError && fallbackLead) {
      lead = fallbackLead;
      leadError = null;
    }
  }
  if ((leadError || !lead) && context) {
    lead = {
      company_name: context.companyName,
      company: context.companyName,
      contact_name: context.contactName,
      name: context.contactName,
      email: context.email,
      verified_email: context.email,
      verified_phone: context.phone,
      linkedin_url: context.linkedinUrl,
      lead_notes: context.leadNotes,
      lead_research_snapshot: context.researchSnapshot,
    };
    leadError = null;
  }
  if (leadError || !lead) return { error: "Lead not found." };

  const companyName = asString(lead.company_name) || asString(lead.company) || "the company";
  const contactName = asString(lead.contact_name) || asString(lead.name) || "there";
  const email = asString(lead.email) || asString(lead.verified_email);
  const phone = asString(lead.verified_phone);
  const linkedinUrl = asString(lead.linkedin_url);
  const notes = asString(lead.lead_notes).trim();
  const researchSnapshot = lead.lead_research_snapshot ? JSON.stringify(lead.lead_research_snapshot) : "";

  const apiKey = process.env.OPENAI_API_KEY;
  let script = "";
  let warning: string | null = null;
  try {
    if (!apiKey) {
      warning = "OPENAI_API_KEY is missing. Using a fallback script.";
      script = `Hi ${contactName},\n\nQuick note from BeTeachable. I noticed ${companyName} is pushing in the ${industry} space. If you're open to it, I can share a fast, direct plan to improve response rates and pipeline quality without wasting time.\n\nIf it helps, I can send a 2–3 step outline tailored to you.`;
    } else {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are the BeTeachable Business Assistant. Methodology: TUFF LOVE. Write short, direct outreach scripts in plain text. No markdown. Keep it under 120 words.",
            },
            {
              role: "user",
              content: [
                `Create a Tuff Love outreach script for ${contactName} at ${companyName} in the ${industry} industry.`,
                `Email: ${email || "unknown"}. Phone: ${phone || "unknown"}. LinkedIn: ${linkedinUrl || "unknown"}.`,
                notes ? `Lead Notes:\n${notes}` : "Lead Notes: none.",
                researchSnapshot ? `People Search Snapshot:\n${researchSnapshot}` : "People Search Snapshot: none.",
              ].join("\n"),
            },
          ],
          temperature: 0.6,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      script = data.choices?.[0]?.message?.content || "No script generated.";
    }
  } catch (err: unknown) {
    warning = getErrorMessage(err) || "Script generation failed. Using fallback script.";
    script = `Hi ${contactName},\n\nQuick note from BeTeachable. I noticed ${companyName} is pushing in the ${industry} space. If you're open to it, I can share a fast, direct plan to improve response rates and pipeline quality without wasting time.\n\nIf it helps, I can send a 2–3 step outline tailored to you.`;
  }

  let nextNotes: string | null = null;
  let noteEntryInserted = false;
  const scriptNote = `[${new Date().toLocaleString()}] Tuff Love Script\n${script}`;
  const insertNoteEntry = async () => {
    if (noteEntryInserted) return;
    try {
      await supabase.from("lead_note_entries").insert({
        lead_id: leadId,
        user_id: user.id,
        content: scriptNote,
      });
      noteEntryInserted = true;
    } catch {
      // ignore note archive failures
    }
  };
  if (!columns || columns.has("lead_notes")) {
    nextNotes = notes ? `${notes}\n\n${scriptNote}` : scriptNote;
  } else {
    warning = warning || "Lead notes are not configured. Apply migration 20250125191500_add_lead_notes.sql.";
  }

  const updates: Record<string, unknown> = {
    ai_generated_script: script,
    ...(nextNotes ? { lead_notes: nextNotes } : {}),
  };

  const query = supabase
    .from("leads")
    .update(updates)
    .eq("id", leadId)
    .eq("user_id", user.id);
  const { data: updatedRows, error } = await query.select("id");
  if (!error && updatedRows && updatedRows.length > 0) {
    await insertNoteEntry();
    revalidatePath("/dashboard/intel");
    revalidatePath(`/dashboard/intel/${leadId}`);
    return { ok: true, warning, script };
  }
  if (!error && (!updatedRows || updatedRows.length === 0)) {
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", leadId)
      .select("id");
    if (fallbackError || !fallbackRows || fallbackRows.length === 0) {
      await insertNoteEntry();
      if (noteEntryInserted) {
        return { ok: true, warning: "Script saved to archive, but lead record could not be updated.", script };
      }
      return { error: fallbackError?.message || "Update blocked. Lead not found or access denied." };
    }
    await insertNoteEntry();
  } else if (error && (error.message || "").includes("user_id")) {
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", leadId)
      .select("id");
    if (fallbackError || !fallbackRows || fallbackRows.length === 0) {
      await insertNoteEntry();
      if (noteEntryInserted) {
        return { ok: true, warning: "Script saved to archive, but lead record could not be updated.", script };
      }
      return { error: fallbackError?.message || "Update blocked. Lead not found or access denied." };
    }
    await insertNoteEntry();
  } else if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/intel");
  revalidatePath(`/dashboard/intel/${leadId}`);
  return { ok: true, warning, script };
}

export async function convertLeadToDealAction(leadId: string, companyName: string, ownerMode: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const dealColumns = await getDealColumnSet(supabase);
    let teamId: string | null = null;
    if (!dealColumns || dealColumns.has("team_id")) {
      try {
        teamId = await getActiveTeamId(supabase);
      } catch {
        teamId = null;
      }
    }

    const { data: lead } = await supabase
      .from("leads")
      .select("company_name, company, contact_name, name")
      .eq("id", leadId)
      .single();

    const dealName = companyName || lead?.company_name || lead?.company || "New Deal";
    const basePayload: Record<string, unknown> = {
      deal_name: dealName,
      stage: "New",
      owner_mode: ownerMode,
      user_id: user.id,
      lead_id: leadId,
    };
    if (teamId) basePayload.team_id = teamId;

    const payloads: Record<string, unknown>[] = [];
    if (dealColumns) {
      const filtered: Record<string, unknown> = {};
      Object.entries(basePayload).forEach(([key, value]) => {
        if (dealColumns.has(key)) filtered[key] = value;
      });
      if (Object.keys(filtered).length > 0) payloads.push(filtered);
    } else {
      payloads.push({ ...basePayload });
    }

    payloads.push({
      deal_name: dealName,
      stage: "New",
      owner_mode: ownerMode,
      ...(dealColumns && dealColumns.has("user_id") ? { user_id: user.id } : {}),
      ...(teamId ? { team_id: teamId } : {}),
    });
    payloads.push({
      name: dealName,
      stage: "New",
      owner_mode: ownerMode,
      ...(dealColumns && dealColumns.has("user_id") ? { user_id: user.id } : {}),
      ...(teamId ? { team_id: teamId } : {}),
    });

    let lastError = "";
    let dealId: string | null = null;
    for (const attempt of payloads) {
      const result = await supabase
        .from("deals")
        .insert(attempt)
        .select("id")
        .single();
      if (!result.error && result.data?.id) {
        dealId = result.data.id;
        break;
      }

      const message = result.error?.message || "";
      lastError = message || lastError;
      if (message.toLowerCase().includes("row violates row-level security")) {
        return { error: "Deal insert blocked by security policy. Apply deals insert policy." };
      }
      const missingColumnMatch =
        message.match(/column \"([^\"]+)\"/i) ||
        message.match(/'([^']+)' column/i) ||
        message.match(/find the '([^']+)' column/i);
      if (missingColumnMatch?.[1]) {
        const missingColumn = missingColumnMatch[1];
        delete attempt[missingColumn];
        if (Object.keys(attempt).length > 0) payloads.push({ ...attempt });
      }
    }

    if (!dealId) {
      return { error: lastError || "Unable to create deal." };
    }

    const leadColumns = await getLeadColumnSet(supabase);
    const leadUpdates: Record<string, unknown> = {};
    if (!leadColumns || leadColumns.has("status")) leadUpdates.status = "Qualified";
    if (!leadColumns || leadColumns.has("pipeline_stage")) leadUpdates.pipeline_stage = "Proposal";

    if (Object.keys(leadUpdates).length > 0) {
      let updateQuery = supabase.from("leads").update(leadUpdates).eq("id", leadId);
      const usesUserFilter = !leadColumns || leadColumns.has("user_id");
      if (usesUserFilter) updateQuery = updateQuery.eq("user_id", user.id);
      const { data: updatedRows, error: updateError } = await updateQuery.select("id");
      if (updateError || !updatedRows || updatedRows.length === 0) {
        await supabase.from("leads").update(leadUpdates).eq("id", leadId);
      }
    }

    revalidatePath("/dashboard/deals");
    revalidatePath("/dashboard/tactix");
    revalidatePath(`/dashboard/intel/${leadId}`);
    return { ok: true, dealId };
  } catch (err: unknown) {
    return { error: getErrorMessage(err) || "Unable to convert lead." };
  }
}
export async function saveUnderwritingInputsAction(dealId: string, formData: FormData) {
  void dealId;
  void formData;
}
export async function addInvoiceItemAction(invoiceId: string, formData: FormData) {
  void invoiceId;
  void formData;
}
export async function deleteInvoiceItemAction(itemId: string, invoiceId: string) {
  void itemId;
  void invoiceId;
}
export async function updateInvoiceStatusAction(invoiceId: string, status: string) {
  void invoiceId;
  void status;
}
export async function sendInvoiceEmailAction(invoiceId: string, email: string) {
  void invoiceId;
  void email;
}
export async function updateTrainingAction(moduleId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const title = String(formData.get("title") || "").trim() || "Untitled Module";
  const description = String(formData.get("description") || "").trim();
  const contentBody = String(formData.get("content_body") || "").trim();
  const videoUrl = String(formData.get("video_url") || "").trim();

  const { error } = await supabase
    .from("training_modules")
    .update({
      title,
      description: description || null,
      content_body: contentBody || null,
      video_url: videoUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", moduleId);

  if (error) return;

  revalidatePath("/dashboard/war-chest");
  revalidatePath(`/dashboard/war-chest/${moduleId}`);
}

export async function createTrainingAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase
    .from("training_modules")
    .insert({
      user_id: user.id,
      title: "New Module",
      description: "Add a summary for this module.",
      category: "General",
      content_body: "",
    })
    .select("id")
    .single();

  if (error || !data?.id) return;

  revalidatePath("/dashboard/war-chest");
  redirect(`/dashboard/war-chest/${data.id}`);
}
export async function inviteMemberAction(email: string) {
  void email;
}
export async function createCompanyAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const rawWebsite = String(formData.get("website") || "").trim();
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const { data: company, error } = await supabase
    .from("companies")
    .insert({
      name,
      slug: slug || null,
      website: rawWebsite || null,
      owner_user_id: user.id,
    })
    .select("id")
    .single();

  let companyId = company?.id;
  if (!companyId) {
    const { data: fallbackCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_user_id", user.id)
      .eq("name", name)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    companyId = fallbackCompany?.id;
  }
  if (!companyId || error) return;

  await supabase
    .from("company_members")
    .upsert(
      {
        company_id: companyId,
        user_id: user.id,
        role: "owner",
        status: "active",
      },
      { onConflict: "company_id,user_id" }
    );

  revalidatePath("/dashboard/companies");
  revalidatePath("/dashboard/level10");
  redirect(`/dashboard/companies/${companyId}`);
  return;
}

export async function enqueueCompanySeoJobAction(companyId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  const { data: company } = await supabase
    .from("companies")
    .select("id, website")
    .eq("id", companyId)
    .single();

  if (!company?.website) {
    redirect(`/dashboard/companies/${companyId}?seo=missing_website`);
  }

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { count: dayCount } = await supabase
    .from("company_seo_jobs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("requested_at", dayAgo);

  if ((dayCount || 0) >= 2) {
    redirect(`/dashboard/companies/${companyId}?seo=limit_day`);
  }

  const { count: monthCount } = await supabase
    .from("company_seo_jobs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("requested_at", monthAgo);

  if ((monthCount || 0) >= 6) {
    redirect(`/dashboard/companies/${companyId}?seo=limit_month`);
  }

  const { data: job, error } = await supabase
    .from("company_seo_jobs")
    .insert({
      company_id: companyId,
      website: company.website,
      requested_by: user.id,
    })
    .select("id")
    .single();

  if (error || !job) {
    redirect(`/dashboard/companies/${companyId}?seo=error`);
  }

  revalidatePath(`/dashboard/companies/${companyId}`);
  redirect(`/dashboard/companies/${companyId}?seo=queued`);
}

export async function inviteCompanyMemberAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const companyId = String(formData.get("company_id") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "rep").trim() || "rep";
  if (!companyId || !email) return;

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("company_invites").insert({
    company_id: companyId,
    email,
    role,
    invited_by: user.id,
    token,
    expires_at: expiresAt,
  });

  if (error) return;

  revalidatePath("/dashboard/the-unit");
  revalidatePath("/dashboard/companies");
  return;
}

function buildDnaModuleContent({
  title,
  core_promise,
  voice_rules,
  audience,
  offers,
  non_negotiables,
  scoreboard,
  summary,
  brain_notes,
  notes,
}: {
  title: string;
  core_promise?: string;
  voice_rules?: string;
  audience?: string;
  offers?: string;
  non_negotiables?: string;
  scoreboard?: string;
  summary?: string;
  brain_notes?: string;
  notes?: string;
}) {
  const sections = [
    title ? `Title: ${title}` : null,
    core_promise ? `Core promise:\n${core_promise}` : null,
    voice_rules ? `Voice rules & tone:\n${voice_rules}` : null,
    audience ? `Audience DNA:\n${audience}` : null,
    offers ? `Offers & outcomes:\n${offers}` : null,
    non_negotiables ? `Non-negotiables & standards:\n${non_negotiables}` : null,
    scoreboard ? `Scoreboard/KPIs:\n${scoreboard}` : null,
    summary ? `DNA summary:\n${summary}` : null,
    brain_notes ? `Brain notes:\n${brain_notes}` : null,
    notes ? `Additional notes:\n${notes}` : null,
  ];

  return sections.filter(Boolean).join("\n\n");
}

async function upsertTrainingModuleForDna(
  supabase: Awaited<ReturnType<typeof createClient>>,
  {
    sourceKey,
    sourceType,
    userId,
    companyId,
    title,
    description,
    contentBody,
  }: {
    sourceKey: string;
    sourceType: string;
    userId: string;
    companyId: string | null;
    title: string;
    description: string;
    contentBody: string;
  }
) {
  try {
    await supabase
      .from("training_modules")
      .upsert(
        {
          source_key: sourceKey,
          source_type: sourceType,
          user_id: userId,
          company_id: companyId,
          title,
          description,
          category: "DNA",
          content_body: contentBody,
          auto_published: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "source_key" }
      );
  } catch {
    return;
  }
}

export async function saveUserDnaProfileAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const dnaProfile = {
    core_promise: String(formData.get("core_promise") || "").trim(),
    voice_rules: String(formData.get("voice_rules") || "").trim(),
    audience: String(formData.get("audience") || "").trim(),
    offers: String(formData.get("offers") || "").trim(),
    non_negotiables: String(formData.get("non_negotiables") || "").trim(),
    scoreboard: String(formData.get("scoreboard") || "").trim(),
    notes: String(formData.get("notes") || "").trim(),
  };

  const dnaText = String(formData.get("dna_text") || "").trim();
  const brainText = String(formData.get("brain_text") || "").trim();

  await supabase
    .from("user_dna_profiles")
    .upsert(
      {
        user_id: user.id,
        dna_profile: dnaProfile,
        dna_text: dnaText || null,
        brain_text: brainText || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  const userDnaContent = buildDnaModuleContent({
    title: "My DNA",
    core_promise: dnaProfile.core_promise,
    voice_rules: dnaProfile.voice_rules,
    audience: dnaProfile.audience,
    offers: dnaProfile.offers,
    non_negotiables: dnaProfile.non_negotiables,
    scoreboard: dnaProfile.scoreboard,
    summary: dnaText,
    brain_notes: brainText,
    notes: dnaProfile.notes,
  });

  await upsertTrainingModuleForDna(supabase, {
    sourceKey: `user_dna:${user.id}`,
    sourceType: "user_dna",
    userId: user.id,
    companyId: null,
    title: "My DNA",
    description: "Personal DNA profile",
    contentBody: userDnaContent,
  });

  revalidatePath("/dashboard/the-code");
  revalidatePath("/dashboard/war-chest");
}

export async function uploadUserDnaDocumentAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("No file provided.");
  }

  const safeName = sanitizeFilename(file.name);
  const filePath = `${user.id}/${Date.now()}-${safeName}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase
    .storage
    .from("user-dna")
    .upload(filePath, fileBuffer, { contentType: file.type || "application/octet-stream" });
  if (uploadError) throw new Error(uploadError.message);

  const { data: insertedDoc, error: insertError } = await supabase
    .from("user_dna_documents")
    .insert({
      user_id: user.id,
      file_path: filePath,
      file_name: file.name,
      content_type: file.type || null,
    })
    .select("id, file_name, file_path, content_type, created_at")
    .single();
  if (insertError) throw new Error(insertError.message);

  if (insertedDoc) {
    const contentBody = [
      "DNA document upload.",
      `File: ${insertedDoc.file_name}`,
      insertedDoc.content_type ? `Content type: ${insertedDoc.content_type}` : null,
      `Path: ${insertedDoc.file_path}`,
      insertedDoc.created_at ? `Uploaded: ${insertedDoc.created_at}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await upsertTrainingModuleForDna(supabase, {
      sourceKey: `user_dna_doc:${insertedDoc.id}`,
      sourceType: "dna_document",
      userId: user.id,
      companyId: null,
      title: `DNA File: ${insertedDoc.file_name}`,
      description: "Uploaded DNA document",
      contentBody,
    });
  }

  revalidatePath("/dashboard/the-code");
  revalidatePath("/dashboard/war-chest");
}

export async function deleteUserDnaDocumentAction(documentId: string, filePath: string) {
  const supabase = await createClient();
  const { error: storageError } = await supabase
    .storage
    .from("user-dna")
    .remove([filePath]);
  if (storageError) {
    const message = storageError.message || "";
    if (!message.toLowerCase().includes("not found")) {
      throw new Error(storageError.message);
    }
  }

  const { error } = await supabase.from("user_dna_documents").delete().eq("id", documentId);
  if (error) throw new Error(error.message);
  await supabase.from("training_modules").delete().eq("source_key", `user_dna_doc:${documentId}`);
  revalidatePath("/dashboard/the-code");
  revalidatePath("/dashboard/war-chest");
}

export async function saveCompanyDnaProfileAction(companyId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const dnaProfile = {
    core_promise: String(formData.get("core_promise") || "").trim(),
    voice_rules: String(formData.get("voice_rules") || "").trim(),
    audience: String(formData.get("audience") || "").trim(),
    offers: String(formData.get("offers") || "").trim(),
    non_negotiables: String(formData.get("non_negotiables") || "").trim(),
    scoreboard: String(formData.get("scoreboard") || "").trim(),
    notes: String(formData.get("notes") || "").trim(),
    text: String(formData.get("dna_text") || "").trim(),
  };

  const brainProfile = {
    text: String(formData.get("brain_text") || "").trim(),
  };

  await supabase
    .from("company_profiles")
    .upsert(
      {
        company_id: companyId,
        created_by: user.id,
        dna_profile: dnaProfile,
        brain_profile: brainProfile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id" }
    );

  await supabase
    .from("companies")
    .update({
      dna_profile: dnaProfile,
      brain_profile: brainProfile,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single();

  const companyTitle = company?.name ? `${company.name} DNA` : "Company DNA";
  const companyDnaContent = buildDnaModuleContent({
    title: companyTitle,
    core_promise: dnaProfile.core_promise,
    voice_rules: dnaProfile.voice_rules,
    audience: dnaProfile.audience,
    offers: dnaProfile.offers,
    non_negotiables: dnaProfile.non_negotiables,
    scoreboard: dnaProfile.scoreboard,
    summary: dnaProfile.text,
    brain_notes: brainProfile.text,
    notes: dnaProfile.notes,
  });

  await upsertTrainingModuleForDna(supabase, {
    sourceKey: `company_dna:${companyId}`,
    sourceType: "company_dna",
    userId: user.id,
    companyId,
    title: companyTitle,
    description: "Company DNA profile",
    contentBody: companyDnaContent,
  });

  revalidatePath("/dashboard/companies");
  revalidatePath(`/dashboard/companies/${companyId}`);
  revalidatePath("/dashboard/war-chest");
}

export async function uploadCompanyDnaDocumentAction(companyId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const file = formData.get("file");
  const title = String(formData.get("title") || "").trim();
  if (!file || !(file instanceof File)) {
    throw new Error("No file provided.");
  }

  const safeName = sanitizeFilename(file.name);
  const filePath = `${companyId}/${Date.now()}-${safeName}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase
    .storage
    .from("company-documents")
    .upload(filePath, fileBuffer, { contentType: file.type || "application/octet-stream" });
  if (uploadError) throw new Error(uploadError.message);

  const { data: insertedDoc, error: insertError } = await supabase
    .from("company_documents")
    .insert({
      company_id: companyId,
      uploaded_by: user.id,
      title: title || file.name,
      doc_type: "dna",
      file_path: filePath,
      metadata: {
        contentType: file.type || null,
        size: file.size || null,
        originalName: file.name,
      },
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  if (insertedDoc) {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .single();

    const companyName = company?.name || "Company";
    const contentBody = [
      "Company DNA document upload.",
      `Company: ${companyName}`,
      `File: ${file.name}`,
      file.type ? `Content type: ${file.type}` : null,
      `Path: ${filePath}`,
    ]
      .filter(Boolean)
      .join("\n");

    await upsertTrainingModuleForDna(supabase, {
      sourceKey: `company_dna_doc:${insertedDoc.id}`,
      sourceType: "dna_document",
      userId: user.id,
      companyId,
      title: `${companyName} DNA File: ${file.name}`,
      description: "Uploaded company DNA document",
      contentBody,
    });
  }

  revalidatePath(`/dashboard/companies/${companyId}`);
  revalidatePath("/dashboard/war-chest");
}

export async function deleteCompanyDocumentAction(documentId: string, filePath: string, companyId: string) {
  const supabase = await createClient();
  const { error: storageError } = await supabase
    .storage
    .from("company-documents")
    .remove([filePath]);
  if (storageError) {
    const message = storageError.message || "";
    if (!message.toLowerCase().includes("not found")) {
      throw new Error(storageError.message);
    }
  }

  const { error } = await supabase.from("company_documents").delete().eq("id", documentId);
  if (error) throw new Error(error.message);
  await supabase.from("training_modules").delete().eq("source_key", `company_dna_doc:${documentId}`);

  revalidatePath(`/dashboard/companies/${companyId}`);
  revalidatePath("/dashboard/war-chest");
}

export async function createLevel10SeriesAction(companyId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const title = String(formData.get("title") || "").trim();
  const cadence = String(formData.get("cadence") || "weekly").trim();
  const timezone = String(formData.get("timezone") || "UTC").trim();
  if (!title) return;

  const { error } = await supabase.from("level10_meeting_series").insert({
    company_id: companyId,
    title,
    cadence,
    timezone,
    owner_user_id: user.id,
  });

  if (error) return;
  revalidatePath(`/dashboard/level10/${companyId}`);
  return;
}

export async function createLevel10MeetingInstanceAction(companyId: string, seriesId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("level10_meeting_instances").insert({
    company_id: companyId,
    series_id: seriesId,
    scheduled_for: new Date().toISOString(),
    status: "scheduled",
    created_by: user.id,
  });

  if (error) return;
  revalidatePath(`/dashboard/level10/${companyId}`);
  return;
}
export async function deleteMemberAction(memberId: string) {
  const supabase = await createClient();
  await supabase.from("team_members").delete().eq("id", memberId);
  revalidatePath("/dashboard/the-unit");
}
export async function deleteMyAccountAction() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
}
export async function createTeamAction() {}
export async function createJobAction() {}
export async function uploadCVAction() {}
export async function importLinkedInProfileAction() {}
export async function createMeetingActionStub() {}
export async function createMeetingActionPage() {}
// ALIAS FOR CLIENT COMPATIBILITY
export async function toggleArchiveMeetingAction(id: string) { await deleteMeetingAction(id); }
