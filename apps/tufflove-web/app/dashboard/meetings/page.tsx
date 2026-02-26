import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import MeetingManager from "./client-view";
import { getMissingDnaFields } from "@/lib/dna";

export const dynamic = "force-dynamic";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams?: { open?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/join");
  }

  // Fetch meetings sorted by newest first
  const { data: meetings } = await supabase
    .from("meetings")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: dnaProfileRow } = await supabase
    .from("user_dna_profiles")
    .select("dna_profile")
    .eq("user_id", user.id)
    .maybeSingle();

  const missingDnaFields = getMissingDnaFields((dnaProfileRow?.dna_profile as Record<string, string>) || {});

  const initialSelectedId = searchParams?.open || null;
  return (
    <MeetingManager
      meetings={meetings || []}
      initialSelectedId={initialSelectedId}
      missingDnaFields={missingDnaFields}
    />
  );
}
