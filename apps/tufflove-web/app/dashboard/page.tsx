import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Target, DollarSign, Brain } from "lucide-react";

export const dynamic = "force-dynamic";

type DashboardSearchParams = { page?: string };

export default async function DashboardPage({
  searchParams,
}: {
  // Next can treat searchParams as either an object or a Promise depending on route mode.
  searchParams?: DashboardSearchParams | Promise<DashboardSearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/join");
  }

  // ✅ Safe unwrap for both object and Promise cases
  const sp = await Promise.resolve(searchParams);

  const pageSize = 10;
  const pageNumber = Math.max(1, Number(sp?.page || "1") || 1);
  const from = (pageNumber - 1) * pageSize;
  const to = from + pageSize;

  const { data: activityRows } = await supabase
    .from("meetings")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .range(from, to);

  const hasNextPage = (activityRows?.length || 0) > pageSize;
  const recentActivities = (activityRows || []).slice(0, pageSize);

  return (
    <div
      style={{
        padding: "40px",
        backgroundColor: "#F3F4F6",
        minHeight: "100vh",
        color: "#111827",
      }}
    >
      {/* HEADER */}
      <div className="bg-command-header border-b border-pink-200 rounded-xl px-6 py-4 mb-10">
        <h1
          style={{
            fontSize: "32px",
            fontWeight: "800",
            marginBottom: "8px",
            color: "#111827",
          }}
        >
          Command Center
        </h1>
        <p style={{ color: "#4B5563" }}>
          Welcome back. Here is what is happening today.
        </p>
      </div>

      {/* ACTION CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "24px",
          marginBottom: "40px",
        }}
      >
        {/* Card 1: Engine */}
        <Link href="/dashboard/tactix" style={{ textDecoration: "none" }}>
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "12px",
              padding: "24px",
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "#DBEAFE",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <Target size={24} color="#2563eb" />
            </div>
            <h3
              style={{
                color: "#111827",
                fontSize: "18px",
                fontWeight: "bold",
                marginBottom: "4px",
              }}
            >
              TactiX Engine
            </h3>
            <p style={{ color: "#6B7280", fontSize: "14px" }}>
              Manage leads and launch campaigns.
            </p>
          </div>
        </Link>

        {/* Card 2: Insight */}
        <Link href="/dashboard/briefings" style={{ textDecoration: "none" }}>
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "12px",
              padding: "24px",
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "#EDE9FE",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <Brain size={24} color="#7c3aed" />
            </div>
            <h3
              style={{
                color: "#111827",
                fontSize: "18px",
                fontWeight: "bold",
                marginBottom: "4px",
              }}
            >
              Insight
            </h3>
            <p style={{ color: "#6B7280", fontSize: "14px" }}>
              Analyze recent calls.
            </p>
          </div>
        </Link>

        {/* Card 3: View Pipeline */}
        <Link href="/dashboard/deals" style={{ textDecoration: "none" }}>
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "12px",
              padding: "24px",
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "#D1FAE5",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <DollarSign size={24} color="#059669" />
            </div>
            <h3
              style={{
                color: "#111827",
                fontSize: "18px",
                fontWeight: "bold",
                marginBottom: "4px",
              }}
            >
              View Pipeline
            </h3>
            <p style={{ color: "#6B7280", fontSize: "14px" }}>
              Check active deals.
            </p>
          </div>
        </Link>
      </div>

      {/* ACTIVITY FEED */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "12px",
          padding: "24px",
          border: "1px solid #E5E7EB",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              margin: 0,
              color: "#111827",
            }}
          >
            Recent Activity
          </h2>

          <div style={{ display: "flex", gap: "10px" }}>
            {pageNumber > 1 && (
              <Link
                href={`/dashboard?page=${pageNumber - 1}`}
                style={{
                  fontSize: "12px",
                  color: "#2563eb",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                ← Prev
              </Link>
            )}

            {hasNextPage && (
              <Link
                href={`/dashboard?page=${pageNumber + 1}`}
                style={{
                  fontSize: "12px",
                  color: "#2563eb",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Next →
              </Link>
            )}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #F3F4F6" }}>
          {recentActivities.length === 0 ? (
            <div style={{ padding: "20px 0", color: "#9CA3AF", fontSize: "14px" }}>
              No recent activity yet.
            </div>
          ) : (
            recentActivities.map((activity: any) => (
              <Link
                key={activity.id}
                href={`/dashboard/briefings?open=${activity.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  style={{
                    padding: "20px 0",
                    borderBottom: "1px solid #F3F4F6",
                    display: "flex",
                    gap: "16px",
                  }}
                >
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: "#3b82f6",
                      marginTop: "6px",
                    }}
                  />
                  <div>
                    <p style={{ color: "#111827", fontWeight: "500", marginBottom: "4px" }}>
                      {activity.title || "Untitled Meeting"}
                    </p>
                    <span style={{ color: "#9CA3AF", fontSize: "12px" }}>
                      {activity.created_at ? new Date(activity.created_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
