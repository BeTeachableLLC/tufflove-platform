import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const VALID_TYPES = new Set(["swot", "strengths_matrix"]);

type AssessmentPayload = {
  assessment_type?: string;
  company_id?: string | null;
  responses?: unknown;
  results?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: AssessmentPayload = {};
  try {
    payload = (await request.json()) as AssessmentPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { assessment_type, company_id, responses, results } = payload || {};

  if (!assessment_type || !VALID_TYPES.has(assessment_type)) {
    return NextResponse.json({ error: "Invalid assessment type." }, { status: 400 });
  }

  const insertPayload = {
    assessment_type,
    company_id: company_id || null,
    responses: responses || null,
    results: results || null,
    completed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("assessment_runs")
    .insert(insertPayload)
    .select("id, assessment_type, completed_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
