import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import StrengthsAssessment from "@/components/assessments/StrengthsAssessment";

export const dynamic = "force-dynamic";

type CompanyMembershipRow = {
  companies: {
    id: string;
    name: string;
  } | null;
};

type CompanyOption = {
  id: string;
  name: string;
};

export default async function StrengthsAssessmentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  const { data: memberships } = await supabase
    .from("company_members")
    .select("companies(id, name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const companyOptions = ((memberships || []) as unknown as CompanyMembershipRow[])
    .map((row) => row.companies)
    .filter((company): company is CompanyOption => Boolean(company && company.id));

  return <StrengthsAssessment companyOptions={companyOptions} />;
}
