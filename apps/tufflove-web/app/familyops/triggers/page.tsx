import { redirect } from "next/navigation";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";
import TriggersClient from "./TriggersClient";

export default async function FamilyOpsTriggersPage() {
  const access = await requireFamilyOpsAdmin();

  if (!access.ok) {
    if (access.status === 401) {
      redirect("/sign-in");
    }
    return (
      <main style={{ maxWidth: 860, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>FamilyOps Trigger Service</h1>
        <div
          style={{
            marginTop: 16,
            border: "1px solid #7f1d1d",
            background: "#111",
            color: "#fee2e2",
            borderRadius: 8,
            padding: 16,
            fontWeight: 600,
          }}
        >
          Not authorized. Your account does not have FamilyOps admin access.
        </div>
      </main>
    );
  }

  return <TriggersClient operatorId={access.user.email?.trim() || "familyops-admin"} />;
}
