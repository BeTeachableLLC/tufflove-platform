import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const REPORT_BUCKET = Deno.env.get("SEO_REPORTS_BUCKET") ?? "seo-reports";
const MAX_PAGES = Number(Deno.env.get("SEO_MAX_PAGES") ?? "200");

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

type JobRecord = {
  id: string;
  company_id: string;
  website: string;
  status: string;
};

function normalizeUrl(url: string, base?: string) {
  try {
    const trimmed = url.trim();
    if (!trimmed) return null;
    const isAbsolute = /^https?:\/\//i.test(trimmed);
    return new URL(isAbsolute ? trimmed : trimmed.replace(/^\/+/, ""), base).toString();
  } catch {
    return null;
  }
}

function isHtmlResponse(resp: Response) {
  const contentType = resp.headers.get("content-type") || "";
  return contentType.includes("text/html");
}

function extractLinks(html: string, baseUrl: string) {
  const links = new Set<string>();
  const regex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(html))) {
    const raw = match[1];
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) continue;
    const absolute = normalizeUrl(raw, baseUrl);
    if (absolute) links.add(absolute);
  }
  return Array.from(links);
}

function extractMeta(html: string) {
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const descriptionMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const description = descriptionMatch ? descriptionMatch[1].trim() : null;

  const h1Count = (html.match(/<h1\b/gi) || []).length;

  return { title, description, h1Count };
}

async function crawlSite(startUrl: string) {
  const start = normalizeUrl(startUrl);
  if (!start) throw new Error("Invalid website URL");

  const startHost = new URL(start).host;
  const queue = [start];
  const visited = new Set<string>();

  const pages: Array<{ url: string; status: number; title: string | null; description: string | null; h1Count: number }> = [];
  let failures = 0;

  while (queue.length && visited.size < MAX_PAGES) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;

    const currentHost = new URL(current).host;
    if (currentHost !== startHost) continue;

    visited.add(current);

    try {
      const resp = await fetch(current, { redirect: "follow" });
      const status = resp.status;
      if (!resp.ok) failures += 1;

      if (!isHtmlResponse(resp)) {
        pages.push({ url: current, status, title: null, description: null, h1Count: 0 });
        continue;
      }

      const html = await resp.text();
      const { title, description, h1Count } = extractMeta(html);
      pages.push({ url: current, status, title, description, h1Count });

      const links = extractLinks(html, current);
      for (const link of links) {
        if (visited.size + queue.length >= MAX_PAGES) break;
        if (!visited.has(link)) queue.push(link);
      }
    } catch {
      failures += 1;
      pages.push({ url: current, status: 0, title: null, description: null, h1Count: 0 });
    }
  }

  const missingTitles = pages.filter((page) => !page.title).length;
  const missingDescriptions = pages.filter((page) => !page.description).length;

  const scorePenalty = missingTitles * 2 + missingDescriptions * 2 + failures * 5;
  const score = Math.max(0, 100 - scorePenalty);

  const criticalIssues = failures;
  const issues = [
    ...(missingTitles ? [{ type: "missing_title", count: missingTitles }] : []),
    ...(missingDescriptions ? [{ type: "missing_description", count: missingDescriptions }] : []),
    ...(criticalIssues ? [{ type: "fetch_failures", count: criticalIssues }] : []),
  ];

  const recommendations = [
    ...(missingTitles ? ["Add unique <title> tags to every page."] : []),
    ...(missingDescriptions ? ["Add meta descriptions to improve click-through rates."] : []),
    ...(criticalIssues ? ["Resolve pages that failed to load during crawl."] : []),
  ];

  const summary = `Crawled ${pages.length} pages. ${missingTitles} missing titles, ${missingDescriptions} missing descriptions, ${failures} fetch failures.`;

  return {
    pages,
    score,
    summary,
    issues,
    recommendations,
    criticalIssues,
  };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = await req.json().catch(() => null);
  const record = payload?.record ?? payload?.new ?? payload;
  const jobId = record?.id as string | undefined;

  if (!jobId) {
    return new Response("Missing job id", { status: 400 });
  }

  const { data: job } = await supabase
    .from("company_seo_jobs")
    .select("id, company_id, website, status")
    .eq("id", jobId)
    .single<JobRecord>();

  if (!job) {
    return new Response("Job not found", { status: 404 });
  }

  if (job.status === "completed" || job.status === "running") {
    return new Response("Job already processed", { status: 200 });
  }

  await supabase
    .from("company_seo_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    const crawl = await crawlSite(job.website);

    const reportPayload = {
      pages: crawl.pages,
      generated_at: new Date().toISOString(),
      website: job.website,
    };

    const reportPath = `${job.company_id}/${job.id}.json`;

    await supabase.storage
      .from(REPORT_BUCKET)
      .upload(reportPath, new Blob([JSON.stringify(reportPayload, null, 2)], { type: "application/json" }), {
        upsert: true,
      });

    const { data: report } = await supabase
      .from("company_seo_reports")
      .insert({
        company_id: job.company_id,
        website: job.website,
        score: crawl.score,
        summary: crawl.summary,
        issues: crawl.issues,
        recommendations: crawl.recommendations,
      })
      .select("id")
      .single();

    await supabase
      .from("company_seo_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        report_id: report?.id ?? null,
      })
      .eq("id", jobId);

    return new Response("ok", { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await supabase
      .from("company_seo_jobs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
      .eq("id", jobId);

    return new Response(`failed: ${message}`, { status: 500 });
  }
});
