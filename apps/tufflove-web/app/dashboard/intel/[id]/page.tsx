import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import InteractiveLeadView from "./client-view";

export const dynamic = 'force-dynamic';

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  const { id } = await params;
  const { data: lead } = await supabase.from('leads').select('*').eq('id', id).single();
  const { data: verifications, error: verificationsError } = await supabase
    .from("lead_verifications")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });
  const { data: noteEntries, error: noteEntriesError } = await supabase
    .from("lead_note_entries")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  if (!lead) return <div>Lead not found</div>;

  return (
    <InteractiveLeadView
      lead={lead}
      verifications={verificationsError ? [] : verifications || []}
      noteEntries={noteEntriesError ? [] : noteEntries || []}
    />
  );
}
